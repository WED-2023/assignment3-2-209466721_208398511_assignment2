const DButils = require("./DButils");
const recipes_utils = require("recipes_utils");
async function markAsFavorite(user_id, recipe_id, isExternal = false) {
    if (isExternal) {
        
        await DButils.execQuery(
          `INSERT INTO favorites (user_id, external_recipe_id) VALUES (?, ?)`,
          [user_id, recipe_id]
        );s
    } else {
    
        await DButils.execQuery(
          `INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)`,
          [user_id, recipe_id]
        );
    }
}

async function getFavoriteRecipes(user_id) {
    const recipes = await DButils.execQuery(
        `SELECT recipe_id, external_recipe_id FROM favorites WHERE user_id = ?`,
        [user_id]
    );
    return recipes;
}


async function getFavoriteRecipesPreviews(user_id) {
    const favorites = await getFavoriteRecipes(user_id);
    const previews = [];

    for (let fav of favorites) {
        if (fav.recipe_id) {
            const preview = await recipes_utils.getRecipePreviewById(fav.recipe_id, user_id);
            if (preview) previews.push(preview);
        } else if (fav.external_recipe_id) {
            const preview = await recipes_utils.getSpoonacularRecipePreview(fav.external_recipe_id);
            if (preview) previews.push(preview);
        }
    }
    return previews;
}


module.exports = {
    markAsFavorite,
    getFavoriteRecipes,
    getFavoriteRecipesPreviews,
};