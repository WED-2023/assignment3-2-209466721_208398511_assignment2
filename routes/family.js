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

    // Insert family recipe
    const result = await db.query(
      `INSERT INTO family_recipes (user_id, title, image, prep_time, servings, instructions, family_story, is_vegan, is_vegetarian, is_gluten_free)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, image, prep_time, servings, instructions, family_story, is_vegan || false, is_vegetarian || false, is_gluten_free || false]
    );
    const familyRecipeId = result.insertId;

    // Insert ingredients
    for (const ing of ingredients) {
      await db.query(
        `INSERT INTO ingredients (recipe_id, ingredient, quantity, is_family_recipe)
         VALUES (?, ?, ?, ?)`,
        [familyRecipeId, ing.ingredient, ing.quantity, true]
      );
    }

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
    // Get ingredients
    const ingredients = await db.query(
      `SELECT ingredient, quantity FROM ingredients WHERE recipe_id = ? AND is_family_recipe = true`,
      [recipeId]
    );
    recipe.ingredients = ingredients;
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

module.exports = router; 