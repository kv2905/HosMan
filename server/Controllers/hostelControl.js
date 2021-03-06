// Hostel Control 
const Hostel = require('../Models/Hostel');
const Hosteller = require('../Models/Hosteller');
const bcrypt = require('bcrypt');
const utilFunction = require('../utils/UtillFunction');
const jwt = require('jsonwebtoken');
const whatsappMesg = require('../utils/whatsappMesg');

exports.postCreateHostel = async(req,res) => {
    try{
        const body = req.body;
        var hostelName = body.hostelName;
        var collageName = body.collageName;
        var loginUserName = body.loginUserName;
        var loginPassword = body.loginPassword;
        var hashedPassword = await bcrypt.hash(loginPassword,12);
        var contact = body.contact;     
        var hostellerList = new Array();
        var requestList = new Array();
        var noticeList = new Array();
        var email = body.email;
        var hostelId = utilFunction.getId();
        var findHostel = await Hostel.findOne({loginUserName : loginUserName});
        if(findHostel){
            res.json({Mesg : "User Name Taken"}).status(206);
            return;
        }
        var newHostel = new Hostel({
            hostelId : hostelId,
            hostelName : hostelName,
            collageName : collageName,
            hostellerList : hostellerList,
            requestList : requestList,
            noticeList : noticeList,
            loginUserName : loginUserName,
            loginPassword : hashedPassword,
            email : email,
            contact : contact
        });
        await newHostel.save();
        res.json({Mesg : "Hostel Created"}).status(200);
    }catch(err){
        console.log("Error");
        res.json({mesg : "Some Error"}).status(500);
    }
}


exports.wardenLogin = async(req , res) => {
    try{
        const body = req.body;
        var username = body.username;
        var password = body.password;

        var findHostel = await Hostel.findOne({loginUserName : username});
        if(!findHostel){
            console.log("Hostel Not Found!!!");
            res.json({Mesg : "Hostel with this UserName is Not Found!!!"}).status(206);
            return;
        }

        bcrypt.compare(password , findHostel['loginPassword'], (err, data) => {
            if(err){
                throw new Error(err);
            }else if(data){
                const payload = {
                    warden : findHostel['loginUserName'],
                    hostelId : findHostel['hostelId'],
                }
                const wardenTokenSecret = process.env.wardenTokenSecret;
                const wardenJwtToken = jwt.sign(payload , wardenTokenSecret ,{
                    expiresIn : '6h',
                });
                res.json({
                    success : true,
                    wardenJwtToken : "wardenBearer " + wardenJwtToken,
                }).status(200);
            }
            else{
                console.log("Incorrect Password!!");
                res.json({Mesg : "Incorrect Password!!"}).status(206);
            }
        })
        
    }catch(err){
        console.log(err);
        res.json({Mesg : "Some Error at Server Control"}).status(400);
    }
}

exports.approveHosteller = async(req, res) => {
    try{
        const hostellerId = req.body.hostellerId;
        if(!hostellerId){
            res.json({Mesg : "Hosteller Id not Recieved!1"}).status(206);
            return;
        }
        await Hosteller.updateOne({hostellerId : hostellerId} ,{approved : true});
        await Hostel.updateOne({hostelId : req.hostelId} , {$pull : {requestList : hostellerId}});
        await Hostel.updateOne({hostelId : req.hostelId} , {$push : {hostellerList : hostellerId}});
        //Sending Whatsapp Mesg
        const findHosteller = await Hosteller.findOne({hostellerId : hostellerId});
        const mesgData = "Hello "+findHosteller['hostellerName'] + "\nYour Hostel Request Has been Approved."
                          + "\nNow you are part of Hostel Family." +"\nLogin As hosteller at HosMan" + "\nThank You";
        
        const contact = findHosteller['contact'];
        await whatsappMesg(mesgData , contact);
        
        res.json({Mesg : "Approved!!"}).status(200);
    }catch(err){
        console.log("Some Error At Server!!");
        console.log(err);
        res.json({Mesg : "Some Error at Server"}).status(400);
    }
}

exports.rejectHosteller = async(req, res) => {
    try{
        const hostellerId = req.body.hostellerId;
        if(!hostellerId){
            res.json({Mesg : "HostellerId not Recieved!"}).status(206);
            return;
        }
        await Hosteller.deleteOne({hostellerId : hostellerId});
        await Hostel.updateOne({hostelId : req.hostelId} , {$pull : {requestList : hostellerId}});
        //SEnding Whatsapp Mesg
        const findHosteller = await Hosteller.findOne({hostellerId : hostellerId});
        const mesgData = "Hello " + findHosteller['hostellerName'] + "\nYour Reqeust as Hosteller has been Rejected By warden"
                        + "\nContact Your Hostel Warden For further Process" + "\nThank You";
        const contact = findHosteller['contact'];
        await whatsappMesg(mesgData , contact);
        
        res.json({Mesg : "Hosteller Rejected!!"});
    }catch(err){
        console.log("Some Error at server");
        res.json({Mesg : "Some Error at Server"}).status(400);
    }
}

exports.removeHosteller = async(req ,res) => {
    try{
        const hostellerId = req.body.hostellerId;
        if(!hostellerId){
            res.json({Mesg : "HostellerId not Recieved!"}).status(206);
            return;
        }
        await Hosteller.deleteOne({hostellerId : hostellerId});
        await Hostel.updateOne({hostelId : req.hostelId} , {$pull : {hostellerList : hostellerId}});

        const findHosteller = await Hosteller.findOne({hostellerId : hostellerId});
        const mesgData = "Hello " + findHosteller['hostellerName'] + "\nYou Has been Removed From Your Hostel" 
                            +  "\nNow You are no Longer Hosteller" + "\nContact Your Hostel Warden For further Process" 
                            + "\nThank You";
        const contact = findHosteller['contact'];
        await whatsappMesg(mesgData , contact);

        res.json({Mesg : "Hosteller Removed!!!!"});
    }catch(err){
        console.log("Some Error at server");
        res.json({Mesg : "Some Error at Server"}).status(400);
    }
}

exports.requestList = async(req , res) => {
    try{
        const hostelId = req.hostelId;
        const findHostel = await Hostel.findOne({hostelId : hostelId});

        var requestList = findHostel['requestList'];
        var sendList = new Array();
        for(var i = 0 ; i < requestList.length; i++){
            var getHostellerId = requestList[i];
            var getHosteller = await Hosteller.findOne({hostellerId : getHostellerId});

            var sendHosteller = {
                rollNo : getHosteller['rollNo'],
                roomNo : getHosteller['roomNo'],
                hostellerName : getHosteller['hostellerName'],
                contact : getHosteller['contact'],
                email : getHosteller['email']
            };
            sendList.push(sendHosteller);
        }
        res.json({Mesg : "Request List" , requestList : sendList}).status(200);
    }catch(err){
        console.log('Some Error at server');
        console.log(err);
        res.json({Mesg : "Some error at server"}).status(400);
    }
}


exports.hostellerList = async(req ,res) => {
    try{
        const hostelId = req.hostelId;
        const findHostel = await Hostel.findOne({hostelId : hostelId});

        var hostellerList = findHostel['hostellerList'];
        console.log(hostellerList);
        var sendList = new Array();
        for(var i = 0 ; i < hostellerList.length; i++){
            var getHostellerId = hostellerList[i];
            var getHosteller = await Hosteller.findOne({hostellerId : getHostellerId});
            if(!getHosteller){
                continue;
            }
            var sendHosteller = {
                rollNo : getHosteller['rollNo'],
                roomNo : getHosteller['roomNo'],
                hostellerName : getHosteller['hostellerName'],
                contact : getHosteller['contact'],
                email : getHosteller['email']
            };
            sendList.push(sendHosteller);
        }

        res.json({Mesg : "Hosteller List" , HostellerList : sendList}).status(200);
    }catch(err){
        console.log('Some Error at server');
        console.log(err);
        res.json({Mesg : "Some error at server"}).status(400);
    }   
}

exports.sendNotice = async(req, res) => {
    try{
        var noticeData = req.body.noticeData;
        if(!noticeData){
            res.json({Mesg : "Invalied Request"}).status(206);
            return;
        }  
        const noticePush = {
            data : noticeData
        };
        await Hostel.updateOne({hostelId : req.hostelId} , {$push : {noticeList : noticePush}});
        res.json({Mesg : "Notice Sent Successfully"}).status(200);
    }catch(err){
        console.log("Some Error at Server");
        console.log(err);
        res.json({Mesg : "Some Error at Server"}).status(401);
    }
}


exports.sendMesg = async(req, res) => {
    try{
        var hostelId = req.hostelId;
        var hostellerId = req.body.hostellerId
        console.log(hostellerId);
        const mesgData = req.body.mesgData;
        if(!hostellerId || !mesgData){
            res.json({Mesg : "Not Recived Data"}).status(206);
            return;
        }
        var mesgPush = {
            data : mesgData
        };
        await Hosteller.updateOne({hostellerId : hostellerId} , {$push : {messageList : mesgPush}});
        res.json({Mesg : "Message Sent Succesfully"}).status(200);
        
    }catch(err){
        console.log(err);
        res.json({Mesg : "Some Error at Server"}).status(401);
    }
}

exports.noticeList = async(req ,res) => {
    try{        
        var hostelId = req.body.hostelId;
        var findHostel = await Hostel.findOne({hostelId : hostelId});
        if(!findHostel){
            console.log("Hostel Not available");
            res.json({Mesg : "Hostel not available at db"}).status(206);
            return;
        }
        var noticeList = findHostel['noticeList'];
        res.json({NoticeList : noticeList}).status(200);
    }catch(err){
        console.log(err);
        res.json({Mesg : "Some Error at Server"}).status(401);
    }
}

