var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Authenticate all incoming requests by middleware
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT id FROM users").then((users) => {
      if (users.find((x) => x.id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        next();
      } else {
        res.sendStatus(401);
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});


/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
router.get('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const previews = await user_utils.getFavoriteRecipesPreviews(user_id);
    res.status(200).send(previews);
  } catch (error) {
    next(error); 
  }
});

router.post('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const { recipe_id, external_recipe_id, family_recipe_id } = req.body;
    console.log('Favorites request:', { user_id, recipe_id, external_recipe_id, family_recipe_id });
    
    if (!recipe_id && !external_recipe_id && !family_recipe_id) {
      return res.status(400).json({ message: "Missing recipe_id, external_recipe_id, or family_recipe_id" });
    }
    
    if (external_recipe_id) {
      console.log('Marking external recipe as favorite:', external_recipe_id);
      await user_utils.markAsFavorite(user_id, external_recipe_id, true, false);
    } else if (family_recipe_id) {
      console.log('Marking family recipe as favorite:', family_recipe_id);
      await user_utils.markAsFavorite(user_id, family_recipe_id, false, true);
    } else {
      console.log('Marking local recipe as favorite:', recipe_id);
      await user_utils.markAsFavorite(user_id, recipe_id, false, false);
    }
    
    res.status(201).json({ message: "Recipe marked as favorite!" });
  } catch (error) {
    next(error);
  }
});

// Get last search for the logged-in user
router.get('/last-search', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const db = require("./utils/MySql");
    const [row] = await db.query(
      `SELECT search_query FROM last_search WHERE user_id = ?`,
      [user_id]
    );
    if (!row) return res.status(404).json({ message: "No last search found" });
    res.json({ lastSearch: row.search_query });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
