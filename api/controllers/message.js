'use strict'

var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');

var User = require('../models/message');
var Follow = require('../models/follow');
var Message = require('../models/message');

function probando(req, res){
    res.status(200).send({message: 'Hola que tal'});
}

function saveMessage(req, res){
    var params = req.body;

    if(!params.text || !params.receiver) return res.status(200).send({message: 'Envia los datos necesaios'});

    var message = new Message();
    message.emitter = req.user.sub;
    message.receiver = params.receiver;
    message.text = params.receiver;
    message.created_at = moment().unix();
    message.viewed = 'false';
    
    message.save((err, messageSotred) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});
        if(!messageSotred) return res.status(500).send({message: 'Error al enviar el mensaje'});

        return res.status(200).send({message: messageSotred});

    })
}

function getReceivedMessages(req, res){
    var userId = req.user.sub;

    var page = 1;
    if(req.params.page){
        page = req.params.page;
    }

    var itemsPerPage =4;

    Message.find({receiver: userId}).populate('emitter', 'name surname image nick _id').paginate(page, itemsPerPage, (err, message, total) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});
        if(!message) return res.status(404).send({message: 'Np hay mensajes'});

        return res.status(200).send({
            total,
            pages: Math.ceil(total/itemsPerPage),
            message
        })
    });
}

function getEmmitMessages(req, res){
    var userId = req.user.sub;

    var page = 1;
    if(req.params.page){
        page = req.params.page;
    }

    var itemsPerPage =4;

    Message.find({emitter: userId}).populate('emitter receiver', 'name surname image nick _id').paginate(page, itemsPerPage, (err, message, total) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});
        if(!message) return res.status(404).send({message: 'Np hay mensajes'});

        return res.status(200).send({
            total,
            pages: Math.ceil(total/itemsPerPage),
            message
        })
    });
}

function getUnviewedMessages(req, res){
    var userId = req.user.sub;

    Message.count({receiver:userId, viewed:'false'}).exec((err, count) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});
        return res.status(200).send({
            'unviewed':count
        });
    });
}

function setViewedMessages(req, res){
    var userId = req.user.sub;

    Message.update({receiver: userId, viewed:'false'}, {viewed:'true'}, {"multi": true}, (err, messageUpdate) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});
        return res.status(200).send({
            message: messageUpdate 
        });
    })
}



module.exports = {
    probando,
    saveMessage,
    getReceivedMessages,
    getEmmitMessages,
    getUnviewedMessages,
    setViewedMessages
    
}