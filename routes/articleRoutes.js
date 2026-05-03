
const express = require('express');

const router = express.Router();
const articlesController = require('../controllers/articlesController');
const verifyJWT = require("../middleware/verifyJWT");
const verifyJWTOptional = require("../middleware/verifyJWTOptional");


///api/articles
router.post('/',verifyJWT,  articlesController.createArticle);
router.get('/', verifyJWTOptional, articlesController.listArticles);

router.get('/feed', verifyJWTOptional, articlesController.feedArticles);

router.get('/:slug', verifyJWTOptional, articlesController.getArticleWithSlug);




module.exports = router;