import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
 import  jwt  from "jsonwebtoken";
import { Mongoose } from "mongoose";
const generateAccessAndRefreshTokens = async(userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false })

    return {accessToken, refreshToken}
} catch (error) {
    throw new ApiError(500, "Something went wrong while genrating refrsh and access token")
  }
}


const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation  - not empty
    // check if user already exist :username,email
    //check for images,check for avatar
    //upload them to cloudinary
    // create user Object- create entry in db(database)
    // remove password and refresh token field from response
    // check for user creation
    // return response
    
    // get user details from frontend
    const {fullname, email, username, password} = req.body
    // console.log("email:", email)

    // validation  -any field should not empty

    if(
      [fullname, email, username, password].some((field) => field?.trim() ==="")
    ) {
         throw new ApiError(400, "All fields are required")
    } 

    // check if user already exist :username,email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    }) 



  // check if user already exist :username,email

   if(existedUser){
       throw new ApiError(409, "User with email or username already exists")
   } 

  //  console.log(req.files);

   //check for images,check for avatar
  const avatarLocalPath =  req.files?.avatar[0]?.path;
  // const coverImageLocalPath =  req.files?.coverImage[0]?.path; 

let coverImageLocalPath;
if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
   coverImageLocalPath = req.files.coverImage[0].path
}





if(!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }

  //upload them to cloudinary
 const avatar = await uploadOnCloudinary(avatarLocalPath)
 const coverImage = await uploadOnCloudinary(coverImageLocalPath)
 

 // check if avatar is uploaded on cloudinary since its mandatory field
if(!avatar) {
    throw new ApiError(400, "Avatar file is required") 
}
   
// create user Object- create entry in db(database)
const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "", //here optional chaining is done because above coverImage above is not checked it may happen user 
                                          //has not provided it since its not a mandatory field 
      email,
      password,
      username: username.toLowerCase()
     })
 
     //check for user creation and remove password and refresh token field from response
     // in this step (._id) comes from mongo db as soon as user is registered on mongo db it creates id for each registeration so
     // here we are also trying to check wether user is created or not 
     const createdUser = await User.findById(user._id).select(
           "-password -refreshToken"
     )
     if(!createdUser){
      throw new ApiError(500, "Something went wrong while registering the user")
     }

     // return response
     return res.status(201).json(
      new ApiResponse(200, createdUser, "User registered Successfully")
     )

    })

const loginUser = asyncHandler(async(req, res) => {
   // get data from frontend (req body -> data)
   // username or email 
   //find the user entry in database
   //password check
   // access and refresh token generation
   // send cookies

// get data from frontend (req body -> data)
   const {email, password, username} = req.body

   // username or email 
   if (!username && !email) {
    throw new ApiError(400, "username or email is required")
   }


  //find the user entry in database
   const user = await User.findOne({
    $or: [{username}, {email}]
   })

   if(!user) {
     throw new ApiError(404,"user does not exist please SignUp before Log In ")
   }

   //password check
const isPasswordValid = await user.isPasswordCorrect(password)


   if(!isPasswordValid) {
    throw new ApiError(401,"Invalid User credentials")
  }

   // access and refresh token generation
 const {accessToken, refreshToken } =  await generateAccessAndRefreshTokens(user._id)

 const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

 const options = {
  httpOnly: true,
  secure: true
 }

 return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
          new ApiResponse(200, {
            user: loggedInUser, accessToken, refreshToken
          },
          "User logged in Successfully"
          )
        )
})

const logoutUser = asyncHandler(async(req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
   }

   return res
   .status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
  const incomingRefreshToken =
   req.cookies.refreshToken || 
   req.body.refreshToken //(req.body.refreshToken is for may be someone is sending request from mobile and sending daata in req.body)
   
   if(!incomingRefreshToken){
    throw new ApiError(401, "unauthorized request")
   }

   try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
 
    const user = await User.findById(decodedToken?._id)
   
    if(!user){
     throw new ApiError(401, "Invalid refresh token")
    }
 
    if(incomingRefreshToken!==user?.refreshToken){
     throw new ApiError(401, "Refresh token is expired or used")
    }
 
    const options = {
     httpOnly: true,
     secure: true
    }
 
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
 
 
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
         new ApiResponse(
           200,
           {accessToken, refreshToken: newRefreshToken},
           "Access token refreshed"
         )
    )
   } catch (error) {
       throw new ApiError(401, error?.message || 
      "Invalid refresh token"
      )
   }


})

const changeCurrentPassword = asyncHandler(async(req, res) => {
     const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

     const isPasswordCorrect = await user.isPasswordCorrect(oldPassword) 
     // here await is written because isPasswordCorrect is async method 

     if(!isPasswordCorrect) {
      throw new ApiError(400, "Invalid old Password") 
     }

     user.password = newPassword
     await user.save({validateBeforeSave: false})
     

     return res
     .status(200)
     .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse (200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullname, email} = req.body

    if(!fullname || !email) {
      throw new ApiError(400, "All fields are required")
    }

   const user = await User.findByIdAndUpdate(
      req?.user._id,
      {
        $set: {
          fullname: fullname,
          email: email
        }
      },
      {new: true}


    ).select("-password")


    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req, res)=> {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
      throw new ApiError(400, "Error while uploading on avatar")
    }

   const user =  await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url
        }
      },
      {}
    ).select("password")

    return res
  .status(200)
  .json(
    new ApiResponse(200, user, "Avatar updated succesfully")
  )
})

const updateUserCoverImage = asyncHandler(async(req, res)=> {
  const coverImageLocalPath = req.file?.path
  if(!coverImageLocalPath) {
    throw new ApiError(400, "cover Image file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400, "Error while uploading on cover Image")
  }

 const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    {}
  ).select("password")

  return res
  .status(200)
  .json(
    new ApiResponse(200, user, "Cover image updated succesfully")
  )
})


const getUserChannelProfile = asyncHandler(async(req, res) => {
      const {username} = req.params
      if(!username?.trim()) {
        throw new ApiError(400, "username is missing")
      }

      const channel = await User.aggregate([
        {
          $match: {
            username:username?.toLowerCase()
          }   
       },
       {
        $lookup: {
          from: "subscriptions", // here subscriptions comes from subscription.model.js it becomes subscriptions because when it saved it converts to lowercase and becomes plural
          localField:"_id",
          foreignField: "channel",
          as: "subscribers"
        }
       },
       {
        $lookup: {
          from: "subscriptions",
          localField:"_id",
          foreignField: "subscriber",
          as: "subscribedTo"
        }
       },
       {
        $addFields: {
          subscribersCount: {
            $size: "$subscribers",
          },
          channelSubscribedToCount: {
            $size: "$subscribedTo"
          },
          isSubscribed: {
           $cond: {
             if: {$in: [req.user?._id, "$subscribers.subscriber"]},
             then: true,
             else: false
           }
          }

        }
       },
       {
        $project: {
          fullname: 1,
          username: 1,
          subscribersCount: 1,
          channelSubscribedToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1,
          email: 1,



        }
       }
    ])

    if (channel?.length) {
      throw new ApiError(404, "channel does not exist")
      }

      return res
      .status(200)
      .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
      )
})

const getWatchHistory = asyncHandler(async(req, res) => {
   const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user._id)
      }
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullname: 1,
                      username: 1,
                      avatar: 1
                    }
                  }
                ]
              }
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner"
                }
              }
            }
          ]
        }
      }
   ])

   return res
   .status(200)
   .json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "watch History fetched successfully"
    )
   )
})

export { registerUser, loginUser, 
  logoutUser, refreshAccessToken,
   getCurrentUser, changeCurrentPassword, 
   updateAccountDetails, updateUserAvatar,
   updateUserCoverImage, getUserChannelProfile,
   getWatchHistory }