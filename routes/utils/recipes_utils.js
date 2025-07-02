const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";
const db = require('./MySql');


/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info 
 */


async function getRecipeInformation(recipe_id) {
    console.log('apiKey', process.env.spooncular_apiKey);
    return await axios.get(`${api_domain}/${recipe_id}/information`, {
        params: {
            includeNutrition: false,
            apiKey: process.env.spooncular_apiKey
        }
    });
}


async function getRecipeDetails(recipe_id) {
    let recipe_info = await getRecipeInformation(recipe_id);
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree } = recipe_info.data;

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        image: image,
        popularity: aggregateLikes,
        vegan: vegan,
        vegetarian: vegetarian,
        glutenFree: glutenFree,
        
    }
}

async function createRecipe({
  userId,
  title,
  image,
  prep_time,
  servings,
  instructions,
  is_vegan,
  is_vegetarian,
  is_gluten_free,
  ingredients // Array of { ingredient, quantity }
}) 

{
    const recipeResult = await db.query(
    `INSERT INTO recipes (user_id, title, image, prep_time, servings, instructions, is_vegan, is_vegetarian, is_gluten_free)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      title,
      image,
      prep_time,
      servings,
      Array.isArray(instructions) ? instructions.join('\n') : instructions, 
      is_vegan || false,
      is_vegetarian || false,
      is_gluten_free || false
    ]
  );
  const recipeId = recipeResult.insertId;


  for (const ing of ingredients) {
    await db.query(
      `INSERT INTO ingredients (recipe_id, ingredient, quantity, is_family_recipe)
       VALUES (?, ?, ?, ?)`,
      [recipeId, ing.ingredient, ing.quantity, false]
    );
  }

  return recipeId;
}

async function getRecipePreviews(userId) {
  const previews = await db.query(
    `
    SELECT
    r.id,
    r.title,
    r.image,
    r.prep_time,
    r.is_vegan,
    r.is_vegetarian,
    r.is_gluten_free,
    IFNULL(fav.likes, 0) AS likes,
    CASE WHEN v.user_id IS NULL THEN FALSE ELSE TRUE END AS viewed,
    CASE WHEN f2.user_id IS NULL THEN FALSE ELSE TRUE END AS favorited
    FROM recipes r
    LEFT JOIN (SELECT recipe_id, COUNT(*) AS likes FROM favorites GROUP BY recipe_id) fav
      ON r.id = fav.recipe_id
    LEFT JOIN views v
      ON r.id = v.recipe_id AND v.user_id = ?
    LEFT JOIN favorites f2
      ON r.id = f2.recipe_id AND f2.user_id = ?
    `,
    [userId, userId]
  );

  // Return in frontend-friendly format
  return previews.map(recipe => ({
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    prep_time: recipe.prep_time,
    likes: recipe.likes,
    is_vegan: !!recipe.is_vegan,
    is_vegetarian: !!recipe.is_vegetarian,
    is_gluten_free: !!recipe.is_gluten_free,
    viewed: !!recipe.viewed,
    favorited: !!recipe.favorited
  }));
}


async function getSpoonacularRecipePreview(recipe_id) {
    const { data } = await getRecipeInformation(recipe_id);
    return {
        id: data.id,
        title: data.title,
        image: data.image,
        prep_time: data.readyInMinutes,
        likes: data.aggregateLikes,
        is_vegan: data.vegan,
        is_vegetarian: data.vegetarian,
        is_gluten_free: data.glutenFree,
        viewed: false,
        favorited: false
    };
}

async function getRandomSpoonacularRecipes(n) {
    const response = await axios.get(`${api_domain}/random`, {
        params: { number: n, apiKey: process.env.spooncular_apiKey }
    });
    return response.data.recipes.map(r => ({
        id: r.id,
        title: r.title,
        image: r.image,
        prep_time: r.readyInMinutes,
        likes: r.aggregateLikes,
        is_vegan: r.vegan,
        is_vegetarian: r.vegetarian,
        is_gluten_free: r.glutenFree,
        viewed: false,
        favorited: false
    }));
}
async function searchSpoonacularRecipes({ query, number = 10, cuisine, diet, intolerances }) {
  const params = {
    apiKey: process.env.spoonacular_apiKey,
    query,
    number,
    ...(cuisine ? { cuisine } : {}),
    ...(diet ? { diet } : {}),
    ...(intolerances ? { intolerances } : {})
  };
  const { data } = await axios.get(`${api_domain}/complexSearch`, { params });
  return data.results.map(r => ({
    id: r.id,
    title: r.title,
    image: r.image,
    prep_time: r.readyInMinutes,
    likes: r.aggregateLikes,
    is_vegan: r.vegan,
    is_vegetarian: r.vegetarian,
    is_gluten_free: r.glutenFree,
    viewed: false,
    favorited: false
  }));
}

async function getRecipePreviewById(recipeId, userId) {
  const [recipe] = await db.query(
    `
    SELECT
      r.id,
      r.title,
      r.image,
      r.prep_time,
      r.is_vegan,
      r.is_vegetarian,
      r.is_gluten_free,
      IFNULL(fav.likes, 0) AS likes,
      CASE WHEN v.user_id IS NULL THEN FALSE ELSE TRUE END AS viewed,
      CASE WHEN f2.user_id IS NULL THEN FALSE ELSE TRUE END AS favorited
    FROM recipes r
      LEFT JOIN (SELECT recipe_id, COUNT(*) AS likes FROM favorites GROUP BY recipe_id) fav
        ON r.id = fav.recipe_id
      LEFT JOIN views v
        ON r.id = v.recipe_id AND v.user_id = ?
      LEFT JOIN favorites f2
        ON r.id = f2.recipe_id AND f2.user_id = ?
    WHERE r.id = ?
    `,
    [userId, userId, recipeId]
  );
  if (!recipe) return null;

  return {
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    prep_time: recipe.prep_time,
    likes: recipe.likes,
    is_vegan: !!recipe.is_vegan,
    is_vegetarian: !!recipe.is_vegetarian,
    is_gluten_free: !!recipe.is_gluten_free,
    viewed: !!recipe.viewed,
    favorited: !!recipe.favorited
  };
}

async function getUserRecipes(userId) {
  const recipes = await db.query(
    `SELECT id, title, image, prep_time, is_vegan, is_vegetarian, is_gluten_free
     FROM recipes
     WHERE user_id = ?`, [userId]);
  return recipes;
}

module.exports = {
    getRecipeInformation,
    getRecipeDetails,
    getRecipePreviews,
    createRecipe,
    getSpoonacularRecipePreview,
    getRandomSpoonacularRecipes,
    searchSpoonacularRecipes,
    getUserRecipes,
    getRecipePreviewById
};



