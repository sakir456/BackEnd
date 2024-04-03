import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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


export {registerUser}