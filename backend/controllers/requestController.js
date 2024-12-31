import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { User } from "../models/user.js";
import { Donor } from "../models/donor.js";
import { Request } from "../models/request.js";
import { Post } from "../models/post.js";
import { recalculateAllRatings } from './ratingController.js'; 
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

export const addRequest = async (req, res) => {
  try {
    const { donorUsername, userUsername, location, availableFood, post_id } =
      req.body;

    console.log(req.body);

    // Validate required fields
    if (!donorUsername || !userUsername || !availableFood) {
      return res.status(400).json({
        message:
          "Donor username, user username, and available food are required",
      });
    }

    // Check if the donor exists
    const donorExists = await Donor.exists({ username: donorUsername });
    if (!donorExists) {
      return res.status(400).json({
        message: `Donor with username ${donorUsername} does not exist`,
      });
    }

    // Check if the user exists
    const userExists = await User.exists({ username: userUsername });
    if (!userExists) {
      return res
        .status(400)
        .json({ message: `User with username ${userUsername} does not exist` });
    }

    // Check if the request already exists
    const requestExists = await Request.exists({
      donorUsername,
      userUsername,
      post_id, // Check if there's already a request with the same donor, user, and post ID
    });

    if (requestExists) {
      return res.status(201).json({ message: "Request already exists" });
    }

    // Create a new request
    const newRequest = new Request({
      donorUsername,
      userUsername,
      location,
      availableFood,
      post_id, // Include post_id only if it's provided
    });

    await newRequest.save();

    res
      .status(201)
      .json({ message: "Request created successfully", request: newRequest });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const requestId = req.params.id;

    // Find the request that is being accepted
    const acceptedRequest = await Request.findById(requestId);

    if (!acceptedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    const postId = acceptedRequest.post_id;
    const userUsername = acceptedRequest.userUsername;
    const donorUsername = acceptedRequest.donorUsername;

    // Find the user associated with the request (using userUsername)
    const user = await User.findOne({ username: userUsername });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the donor associated with the request (using donorUsername)
    const donor = await Donor.findOne({ username: donorUsername });

    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }

    // Ensure donor's name is populated
    if (!donor.username) {
      return res.status(400).json({ message: "Donor's name is missing. Cannot accept request." });
    }

    // Increment the user's donorOrdersCount
    user.donorOrdersCount += 1;

    // Increment the donor's donationsCount
    donor.donationsCount += 1;

    // Save the updated user and donor data
    await user.save();
    await donor.save();
    await recalculateAllRatings();
    // Set isAccepted to true for the accepted request
    const updatedRequest = await Request.findByIdAndUpdate(
      requestId,
      { isAccepted: true },
      { new: true }
    );

    // Reject all other requests for this post
    await Request.updateMany(
      { post_id: postId, _id: { $ne: requestId } }, // Exclude the accepted request
      { isRejected: true }
    );

    // Update the post to set isDealClosed to true
    await Post.findByIdAndUpdate(postId, { isDealClosed: true });

    // Respond with the updated request and donor data
    res.json({
      message: "Request accepted and donor data updated",
      updatedRequest,
      donor: {
        username: donor.username,
        donationsCount: donor.donationsCount,
        name: donor.name, // Include donor's name in response
      },
      user: {
        username: user.username,
        donorOrdersCount: user.donorOrdersCount,
      }
    });
  } catch (error) {
    console.error("Error accepting request:", error);
    res.status(500).json({ message: "Error accepting request", error });
  }
};




export const cancelRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const updatedRequest = await Request.findByIdAndUpdate(
      requestId,
      { isAccepted: false }, // Set isAccepted to false
      { new: true } // Return the updated document
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json(updatedRequest);
  } catch (error) {
    res.status(500).json({ message: "Error cancelling request", error });
  }
};

export const getAcceptedRequests = async (req, res) => {
  try {
    const token = req.cookies.user_jwt;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decodedToken = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    const username = decodedToken.username;

    const acceptedRequests = await Request.find({
      userUsername: username,
      isAccepted: true,
      deliveryAssigned: false,
    });

    res.json({ success: true, acceptedRequests });
  } catch (error) {
    console.error("Error fetching accepted requests:", error); // Log the error in the console
    res
      .status(500)
      .json({ message: "Error fetching accepted requests", error });
  }
};

export const getRequestsForPost = async (req, res) => {
  try {
    // Get token from cookies and verify it
    const token = req.cookies.donor_jwt;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Verify and decode the JWT to get the donor's username
    const decodedToken = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    const donorUsername = decodedToken.username;
    const { postId } = req.query; // Extract postId from query parameters

    // Fetch all requests where donorUsername and postId match
    const requests = await Request.find({ donorUsername, post_id: postId });

    if (!requests) {
      return res
        .status(404)
        .json({ success: false, message: "No requests found." });
    }

    // Return the list of requests
    res.json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAllDonors = async (req, res) => {
  try {
    const token = req.cookies.user_jwt;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const decodedToken = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    const userUsername = decodedToken.username;
    const uniqueDonors = await Request.distinct("donorUsername", {
      userUsername,
    });
    console.log("Sent Donors based on User's");

    return res.json({
      success: true,
      donors: uniqueDonors.map((username) => ({
        username,
        requests: [],
      })),
    });
  } catch (error) {
    console.error("Error fetching donors:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getRequests = async (req, res) => {
  try {
    const token = req.cookies.user_jwt;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const decodedToken = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    const userUsername = decodedToken.username;
    const donorUsername = req.query.donor;

    const requests = await Request.find({ userUsername, donorUsername })
      .sort({ timestamp: 1 })
      .exec();

    return res.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
