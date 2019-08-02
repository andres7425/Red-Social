'use strict'

var mongoose = require('mongoose');
var app = require('./app');
var port = 3800;

// Conexion Database
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/mean_social', {useMongoClient : true})
    .then(() => {
        console.log('...Conexion realizada exitosa mente');

        // Crear Servidor
        app.listen(port, () => {
            console.log('Servidor creado correctamente'); 
        });
    })
    .catch(err => console.log(err));