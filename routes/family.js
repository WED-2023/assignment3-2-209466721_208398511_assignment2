const express = require("express");
const router = express.Router();
const db = require("./utils/MySql");

// Middleware to authenticate all incoming requests
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    req.user_id = req.session.user_id;
    next();
  } else {
    res.sendStatus(401); // Unauthorized
  }
});

// Create a new family recipe
router.post("/", async (req, res, next) => {
  try {
    const userId = req.user_id;
    const {
      title, image, prep_time, servings, instructions, family_story,
      is_vegan, is_vegetarian, is_gluten_free, ingredients
    } = req.body;

    if (!title || !Array.isArray(ingredients) || ingredients.length === 0 || !instructions || !servings) {
      return res.status(400).json({ message: "Missing or invalid recipe data." });
    }

    // Insert family recipe with ingredients as JSON
    const result = await db.query(
      `INSERT INTO family_recipes (user_id, title, image, prep_time, servings, instructions, family_story, is_vegan, is_vegetarian, is_gluten_free)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, image, prep_time, servings, instructions, family_story, is_vegan || false, is_vegetarian || false, is_gluten_free || false]
    );
    const familyRecipeId = result.insertId;

    // Store ingredients as JSON in a separate field (we'll add this to the family_story field temporarily)
    const ingredientsJson = JSON.stringify(ingredients);
    await db.query(
      `UPDATE family_recipes SET family_story = CONCAT(family_story, ' ||INGREDIENTS||', ?) WHERE id = ?`,
      [ingredientsJson, familyRecipeId]
    );

    res.status(201).json({ message: "Family recipe created successfully", familyRecipeId });
  } catch (error) {
    next(error);
  }
});

// Get all family recipes for the logged-in user
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user_id;
    const recipes = await db.query(
      `SELECT * FROM family_recipes WHERE user_id = ?`,
      [userId]
    );
    res.json(recipes);
  } catch (error) {
    next(error);
  }
});

// Get details of a specific family recipe
router.get("/:id", async (req, res, next) => {
  try {
    const userId = req.user_id;
    const recipeId = req.params.id;
    const [recipe] = await db.query(
      `SELECT * FROM family_recipes WHERE id = ? AND user_id = ?`,
      [recipeId, userId]
    );
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    
    // Extract ingredients from family_story field
    let ingredients = [];
    if (recipe.family_story && recipe.family_story.includes('||INGREDIENTS||')) {
      const parts = recipe.family_story.split('||INGREDIENTS||');
      recipe.family_story = parts[0]; // Keep only the original family story
      if (parts[1]) {
        try {
          ingredients = JSON.parse(parts[1]);
        } catch (e) {
          ingredients = [];
        }
      }
    }
    recipe.ingredients = ingredients;
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// Edit a family recipe (only by creator)
router.put("/:id", async (req, res, next) => {
  try {
    const recipeId = Number(req.params.id);
    const userId = req.user_id;
    
    // Check ownership
    const [familyRecipe] = await db.query("SELECT * FROM family_recipes WHERE id = ?", [recipeId]);
    if (!familyRecipe) return res.status(404).json({ message: 'Family recipe not found' });
    if (familyRecipe.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
    
    // Update recipe with ingredients as JSON
    const { title, image, prep_time, servings, instructions, family_story, is_vegan, is_vegetarian, is_gluten_free, ingredients } = req.body;
    
    // Store ingredients as JSON in family_story
    const ingredientsJson = JSON.stringify(ingredients);
    const updatedFamilyStory = family_story + ' ||INGREDIENTS||' + ingredientsJson;
    
    await db.query(
      `UPDATE family_recipes SET title=?, image=?, prep_time=?, servings=?, instructions=?, family_story=?, is_vegan=?, is_vegetarian=?, is_gluten_free=? WHERE id=?`,
      [title, image, prep_time, servings, instructions, updatedFamilyStory, is_vegan, is_vegetarian, is_gluten_free, recipeId]
    );
    
    res.json({ message: 'Family recipe updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete a family recipe (only by creator)
router.delete("/:id", async (req, res, next) => {
  try {
    const recipeId = Number(req.params.id);
    const userId = req.user_id;
    
    // Check ownership
    const [familyRecipe] = await db.query("SELECT * FROM family_recipes WHERE id = ?", [recipeId]);
    if (!familyRecipe) return res.status(404).json({ message: 'Family recipe not found' });
    if (familyRecipe.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
    
    // Delete recipe (ingredients are stored in family_story field, so they'll be deleted automatically)
    await db.query(`DELETE FROM family_recipes WHERE id=?`, [recipeId]);
    
    res.json({ message: 'Family recipe deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 