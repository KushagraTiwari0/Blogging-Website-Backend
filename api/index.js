require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 4000;
const connectDB = require("../config/dbConnect");
const mongoose = require("mongoose");
var cors = require('cors')
const corsOptions = require('../config/corsOptions');


connectDB();
//user routes => /api/users and /api/user
app.use(cors(corsOptions));
app.use(express.json()); //middleware to parse json

// ping route for cron job
app.get("/ping", (req, res) => {
  console.log(`server awaked at time ${new Date().toLocaleString()}`);
  res.status(200).send("Server is awake");
});

// user routes for /api/users and /api/user
app.use("/api", require("../routes/userRoutes"));

// profile routes
app.use("/api/profiles", require("../routes/profileRoutes"));

// article routes 

app.use("/api/articles", require("../routes/articleRoutes"));

//tag routes

app.use("/api/tags", require("../routes/tagRoutes"));

//comment routes

app.use("/api/articles", require("../routes/commentRoutes"));


mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

mongoose.connection.on('error', (err) => {
    console.log('Error while connection to MongoDB: ',err)
});