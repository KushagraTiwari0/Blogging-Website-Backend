const Article = require("../models/Article");
const User = require("../models/User");


const createArticle = async(req,res) => {
    //in the req\\

    const id = req.userId;

    const author = await User.findById(id).exec();

    const {title = '', description, body, tagList} = req.body.article;



    if(!title || !description || !body){
        return res.status(400).json({message: "All fields are required"});
    }

    const article = await Article.create({title, description, body});

    article.author = id;

    if(Array.isArray(tagList) && tagList.length  > 0 ){
        article.tagList = tagList;
    }

    await article.save();


    return res.status(200).json({article: await article.toArticleResponse(author)});


}

const feedArticles = async (req, res) => {
    try {
        let query = {};
        
        // If it's the personalized feed, we can optionally filter by following
        // For now, let's just return all articles since following logic isn't fully implemented
        // But if there's a tag query, we can filter by tag
        
        const articles = await Article.find(query).sort({ createdAt: -1 }).exec();
        
        const user = req.loggedin ? await User.findById(req.userId).exec() : false;
        
        const formattedArticles = await Promise.all(
            articles.map(async (article) => {
                return await article.toArticleResponse(user);
            })
        );
        
        return res.status(200).json({ articles: formattedArticles });
    } catch (err) {
        console.error('Error fetching feed articles', err);
        return res.status(500).json({ error: 'Error fetching articles' });
    }
}

const listArticles = async (req, res) => {
    try {
        let query = {};
        if (req.query.tag) {
            query.tagList = req.query.tag;
        }
        
        if (req.query.author) {
            const authorUsername = req.query.author.startsWith('@') ? req.query.author.substring(1) : req.query.author;
            const author = await User.findOne({ username: authorUsername }).exec();
            if (author) {
                query.author = author._id;
            } else {
                // If the author doesn't exist, return no articles
                return res.status(200).json({ articles: [] });
            }
        }

        const articles = await Article.find(query).sort({ createdAt: -1 }).exec();
        
        const user = req.loggedin ? await User.findById(req.userId).exec() : false;
        
        const formattedArticles = await Promise.all(
            articles.map(async (article) => {
                return await article.toArticleResponse(user);
            })
        );
        
        return res.status(200).json({ articles: formattedArticles });
    } catch (err) {
        console.error('Error fetching articles', err);
        return res.status(500).json({ error: 'Error fetching articles' });
    }
}

const getArticleWithSlug = async (req,res) => {
    const {slug} = req.params;

    const article = await Article.findOne({slug}).exec();

    if(!article){
        return res.status(404).json({
            message:'Article Not Found'
        })
    }

    return res.status(200).json({
        article:await article.toArticleResponse(false)
    })
}




const updateArticle = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.userId;

        const article = await Article.findOne({ slug }).exec();

        if (!article) {
            return res.status(404).json({ message: 'Article Not Found' });
        }

        // Only the author can update
        if (article.author.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to update this article' });
        }

        const { title, description, body, tagList } = req.body.article;

        if (title !== undefined) article.title = title;
        if (description !== undefined) article.description = description;
        if (body !== undefined) article.body = body;
        if (Array.isArray(tagList)) article.tagList = tagList;

        await article.save();

        const author = await User.findById(userId).exec();
        return res.status(200).json({ article: await article.toArticleResponse(author) });
    } catch (err) {
        console.error('Error updating article', err);
        return res.status(500).json({ error: 'Error updating article' });
    }
};

const deleteArticle = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.userId;

        const article = await Article.findOne({ slug }).exec();

        if (!article) {
            return res.status(404).json({ message: 'Article Not Found' });
        }

        // Only the author can delete
        if (article.author.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to delete this article' });
        }

        await Article.deleteOne({ _id: article._id });
        return res.status(200).json({ message: 'Article deleted successfully' });
    } catch (err) {
        console.error('Error deleting article', err);
        return res.status(500).json({ error: 'Error deleting article' });
    }
};


module.exports = {
    createArticle,
    feedArticles,
    listArticles,
    getArticleWithSlug,
    updateArticle,
    deleteArticle
};
