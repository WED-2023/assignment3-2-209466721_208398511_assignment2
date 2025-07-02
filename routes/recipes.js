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

/**
 * This path returns a full details of a recipe by its id
 */

router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    // Mark as viewed
    const userId = req.user_id;
    const recipeId = req.params.recipeId;
    if (userId) {
      // Check if already viewed
      const existing = await db.query(
        `SELECT id FROM views WHERE user_id = ? AND recipe_id = ?`,
        [userId, recipeId]
      );
      if (!existing.length) {
        await db.query(
          `INSERT INTO views (user_id, recipe_id) VALUES (?, ?)`,
          [userId, recipeId]
        );
      }
    }
    res.send(recipe);
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



module.exports = router;
