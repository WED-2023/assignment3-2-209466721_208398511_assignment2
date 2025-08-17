var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");
const { route } = require("./auth");
const db = require("./utils/MySql");



router.get('/random', async (req, res, next) => {
  try {
    const randomRecipes = await recipes_utils.getRandomSpoonacularRecipes(3);
    res.json(randomRecipes);
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const { query, number, cuisine, diet, intolerances } = req.query;
    const results = await recipes_utils.searchSpoonacularRecipes({
      query, number, cuisine, diet, intolerances
    });
    // Save last search for logged-in user
    if (req.user_id && query) {
      await db.query(
        `REPLACE INTO last_search (user_id, search_query) VALUES (?, ?)` ,
        [req.user_id, query]
      );
    }
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.use(async function (req, res, next) {
  // Middleware to authenticate all incoming requests
  console.log("req.session:", req.session);
  if (req.session && req.session.user_id) {
    req.user_id = req.session.user_id;
    next();
  } else {
    res.sendStatus(401); // Unauthorized
  }
});

router.get("/", (req, res) => res.send("im here"));

router.get("/my", async (req, res, next) => {
  try {
    const userId = req.user_id;
    const myRecipes = await recipes_utils.getUserRecipes(userId); // See function below
    res.json(myRecipes);
  } catch (error) {
    next(error);
  }
});


// Returns recipe previews for the logged-in user
router.get("/previews", async (req, res, next) => {
  try {
    const userId = req.user_id;
    const previews = await recipes_utils.getRecipePreviews(userId);
    res.send(previews);
  } catch (error) {
    next(error);
  }
});

// Get last viewed recipes - MUST come before /:recipeId route

router.get('/last-viewed', async (req, res, next) => {
  try {
    const userId = req.user_id;
    // Get last 3 viewed recipes (any type)
    const viewed = await db.query(
      'SELECT recipe_id, family_recipe_id, external_recipe_id FROM views WHERE user_id = ? ORDER BY id DESC LIMIT 3',
      [userId]
    );
    
    // If no viewed recipes, return empty array
    if (!viewed || viewed.length === 0) {
      return res.json([]);
    }
    
    // Fetch the correct preview for each type
    const recipes = await Promise.all(viewed.map(async v => {
      if (v.recipe_id) {
        return recipes_utils.getRecipePreviewById(v.recipe_id, userId);
      } else if (v.family_recipe_id) {
        return recipes_utils.getFamilyRecipePreviewById(v.family_recipe_id, userId);
      } else if (v.external_recipe_id) {
        return recipes_utils.getSpoonacularRecipePreview(v.external_recipe_id);
      }
      return null;
    }));
    
    // Filter out any null recipes and return
    const validRecipes = recipes.filter(r => r !== null);
    res.json(validRecipes);
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns a full details of a recipe by its id
 */

router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipeId = Number(req.params.recipeId); // Ensure recipeId is a number
    const userId = req.user_id;

    // Try to get as a local recipe (direct DB query)
    const [localRecipe] = await db.query(
      "SELECT * FROM recipes WHERE id = ?",
      [recipeId]
    );

    if (localRecipe) {
      // Mark as viewed for local recipe
      if (userId) {
        const existing = await db.query(
          `SELECT id FROM views WHERE user_id = ? AND recipe_id = ?`,
          [userId, recipeId]
        );
        if (!existing.length) {
          await db.query(
            `INSERT INTO views (user_id, recipe_id) VALUES (?, ?)` ,
            [userId, recipeId]
          );
        }
      }
      // Use your existing getRecipeDetails to format the response
      const recipe = await recipes_utils.getRecipeDetails(recipeId);
      return res.send(recipe);
    } else {
      // Try as external recipe
      try {
        const externalRecipe = await recipes_utils.getRecipeInformation(recipeId);
        if (userId) {
          const existing = await db.query(
            `SELECT id FROM views WHERE user_id = ? AND external_recipe_id = ?`,
            [userId, recipeId]
          );
          if (!existing.length) {
            await db.query(
              `INSERT INTO views (user_id, external_recipe_id) VALUES (?, ?)`,
              [userId, recipeId]
            );
          }
        }
        return res.send(externalRecipe.data);
      } catch (externalError) {
        return res.status(404).json({ message: "Recipe not found" });
      }
    }
  } catch (error) {
    next(error);
  }
});


router.post("/", async (req, res, next) => {
  try {
    const userId = req.user_id;
    const {
      title, image, prep_time, servings, instructions,
      is_vegan, is_vegetarian, is_gluten_free, ingredients
    } = req.body;

    // Basic validation
    if (
      !title ||
      !Array.isArray(ingredients) || ingredients.length === 0 ||
      !instructions || 
      !servings
    ) {
      return res.status(400).json({ message: "Missing or invalid recipe data." });
    }

    const recipeId = await recipes_utils.createRecipe({
      userId,
      title,
      image,
      prep_time,
      servings,
      instructions,
      is_vegan,
      is_vegetarian,
      is_gluten_free,
      ingredients
    });

    res.status(201).json({ message: "Recipe created successfully", recipeId });
  } catch (error) {
    next(error);
  }
});

// Edit a recipe (only by creator)
router.put('/:recipeId', async (req, res, next) => {
  try {
    const recipeId = Number(req.params.recipeId);
    const userId = req.user_id;
    // Check ownership
    const [localRecipe] = await db.query("SELECT * FROM recipes WHERE id = ?", [recipeId]);
    if (!localRecipe) return res.status(404).json({ message: 'Recipe not found' });
    if (localRecipe.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
    // Update recipe
    const { title, image, prep_time, servings, instructions, is_vegan, is_vegetarian, is_gluten_free, ingredients } = req.body;
    await db.query(
      `UPDATE recipes SET title=?, image=?, prep_time=?, servings=?, instructions=?, is_vegan=?, is_vegetarian=?, is_gluten_free=? WHERE id=?`,
      [title, image, prep_time, servings, instructions, is_vegan, is_vegetarian, is_gluten_free, recipeId]
    );
    // Update ingredients: delete old, insert new
    await db.query(`DELETE FROM ingredients WHERE recipe_id=? AND is_family_recipe=false`, [recipeId]);
    for (const ing of ingredients) {
      await db.query(
        `INSERT INTO ingredients (recipe_id, ingredient, quantity, is_family_recipe) VALUES (?, ?, ?, false)`,
        [recipeId, ing.ingredient, ing.quantity]
      );
    }
    res.json({ message: 'Recipe updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete a recipe (only by creator)
router.delete('/:recipeId', async (req, res, next) => {
  try {
    const recipeId = Number(req.params.recipeId);
    const userId = req.user_id;
    // Check ownership
    const [localRecipe] = await db.query("SELECT * FROM recipes WHERE id = ?", [recipeId]);
    if (!localRecipe) return res.status(404).json({ message: 'Recipe not found' });
    if (localRecipe.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
    // Delete recipe and its ingredients
    await db.query(`DELETE FROM ingredients WHERE recipe_id=? AND is_family_recipe=false`, [recipeId]);
    await db.query(`DELETE FROM recipes WHERE id=?`, [recipeId]);
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
