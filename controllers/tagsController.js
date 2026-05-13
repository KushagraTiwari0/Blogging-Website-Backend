const Article = require("../models/Article");



const getTags = async (req, res) => {

    //return distinct tags (case-insensitive deduplicated)

    const rawTags = await Article.find().distinct('tagList').exec();

    // Deduplicate by lowercase — keeps one version of each tag
    const seen = new Map();
    for (const tag of rawTags) {
      const lower = tag.toLowerCase();
      if (!seen.has(lower)) seen.set(lower, lower);
    }

    res.status(200).json({
        tags: [...seen.values()]
    });

};


module.exports = {
    getTags
}