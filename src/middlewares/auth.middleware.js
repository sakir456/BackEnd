import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import  jwt  from "jsonwebtoken";
import { User } from "../models/user.model.js";

// this middleware come in use after logging in
export const verifyJWT = asyncHandler(async(req, _, next) => {

    try {
        //after logging in agiain request from frontend 
      const token =  req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
      if(!token) {
        throw new ApiError(401, "Unauthorized request")
      }
    
      //to verify whether acesstoken is correct or not it is done by jwt method called .verify 
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
      
         const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
         if(!user) {
            
            throw new ApiError(401, "Invalid Access Token")
         }
         
        
         req.user = user;
         next()
    } catch (error) {
        throw new ApiError(401, error?.message ||  "Invalid Access Token")
    }

  })