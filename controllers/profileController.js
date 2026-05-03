const User = require("../models/User");

const getProfile = async (req, res) => {
    const { username } = req.params;
    
    // The frontend sends /profile/@username so we strip the @ if it exists
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    try {
        const user = await User.findOne({ username: cleanUsername }).exec();

        if (!user) {
            return res.status(404).json({ message: 'Profile Not Found' });
        }

        return res.status(200).json({
            profile: {
                username: user.username,
                bio: user.bio || "",
                image: user.image || "https://api.realworld.io/images/smiley-cyrus.jpeg",
                following: false
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error fetching profile' });
    }
};

module.exports = {
    getProfile
};
