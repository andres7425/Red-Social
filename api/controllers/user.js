'use strcit'


var User = require('../models/user');

var bcrypt = require('bcrypt-nodejs');
var jwt = require('../services/jwt');
var monogoosePaginate = require('mongoose-pagination');
var fs = require('fs');
var path = require('path');
var Publication = require('../models/publication');
var Follow = require('../models/follow');


// Metodos de prueba
function home(req, res) {
    res.status(200).send({
        message: 'Accion de pruebas realizada'
    });
}

function pruebas(req, res) {
    console.log(req.body);
    res.status(200).send({
        message: 'Accio de prueba de servidor NodeJS'
    });
}

// Registro de usuarios
function saveUser(req, res) {
    var params = req.body;
    var user = new User();
    if (params.name && params.surname && params.nick && params.email && params.password) {
        user.name = params.name;
        user.surname = params.surname;
        user.nick = params.nick;
        user.email = params.email;
        user.role = 'ROLE_USER';
        user.image = null;

        // evita duplicar datos por campos descritos en $or
        User.find({
            $or: [
                { email: user.email.toLowerCase() },
                { nick: user.nick.toLowerCase() }
            ]
        }).exec((err, users) => {
            if (err) return res.status(500).send({ message: 'Error en la petición de usuarios.' });

            if (users && users.length > 0) {
                return res.status(200).send({ message: 'El usuario ya existe' });
            } else {
                // guardar datos si no existen en la DB
                bcrypt.hash(params.password, null, null, (err, hash) => {
                    user.password = hash;

                    user.save((err, userStored) => {
                        if (err) return res.status(500).send({ message: 'Error al guardar usuario' });
                        if (userStored) {
                            res.status(200).send({ user: userStored })
                        } else {
                            res.status(404).send({ message: 'No se ha registrado el usuario.' })
                        }
                    })
                });

            }

        });


    } else {
        res.status(200).send({
            message: 'Enviar todos los campos necesarios!'
        })
    }

}

// Login
function loginUser(req, res) {
    var params = req.body;

    var email = params.email;
    var password = params.password;

    User.findOne({ email: email }, (err, user) => {
        if (err) return res.status(500).send({ message: 'Error en la petición' });

        if (user) {
            bcrypt.compare(password, user.password, (err, check) => {
                if (check) {
                    if (params.gettoken) {
                        // Generar y Devolver token
                        return res.status(200).send({
                            token: jwt.createToken(user)
                        })
                    } else {
                        // devolver datos de usuario
                        user.password = undefined;
                        return res.status(200).send({ user });

                    }
                } else {
                    return res.status(404).send({ message: 'El usuario no se a podido identificar' })
                }
            });
        } else {
            return res.status(404).send({ message: 'El usuario no se a podido identificar' })
        }
    });
}

// Captar datos de un usuario
function getUser(req, res) {
    var userId = req.params.id;

    User.findById(userId, (err, user) => {
        if (!user) return res.status(404).send({ message: "User Not Found." });
        if (err) return res.status(500).send({ message: "Request Error." });

        followThisUser(req.user.sub, userId).then((value) => {
            return res.status(200).send({
                user,
                following: value.following,
                followed: value.followed
            });
        });
    });
}

async function followThisUser(identity_user_id, user_id) {
    var following = await Follow.findOne({ user: identity_user_id, followed: user_id }).exec()
        .then((following) => {
            return following;
        })
        .catch((err) => {
            return handleError(err);
        });
    var followed = await Follow.findOne({ user: user_id, followed: identity_user_id }).exec()
        .then((followed) => {
            return followed;
        })
        .catch((err) => {
            return handleError(err);
        });

    return {
        following: following,
        followed: followed
    };
}

// Obtener todos los usuarios
function getUsers(req, res) {
    var identity_user_id = req.user.sub;

    var page = 1;
    if (req.params.page) {
        page = req.params.page;
    }

    var itemsPerPage = 5;
    User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total) => {
        if (err) return res.status(500).send({ message: 'Error en la petición.' });

        if (!users) return res.status(404).send({ message: 'No hay usuarios disponibles.' });

        followUserIds(identity_user_id).then((value) => {
            return res.status(200).send({
                users,
                user_following: value.following,
                user_follow_me: value.followed,
                total,
                pages: Math.ceil(total / itemsPerPage) //numero de páginas a mostrar
            });
        });

    });
}

async function followUserIds(user_id) {
    try {
        var following = await await Follow.find({ "user": user_id }).select({ '_id': 0, '__v': 0, 'user': 0 }).exec()
            .then((following) => {
                var follows_clean = [];

                following.forEach((following) => {
                    follows_clean.push(following.followed);
                });
                //console.log(follows_clean);
                return follows_clean;
            })
            .catch((err) => {
                return handleerror(err);
            });
        var followed = await Follow.find({ "followed": user_id }).select({ '_id': 0, '__v': 0, 'followed': 0 }).exec()
            .then((followed) => {
                var follows_clean = [];

                followed.forEach((followed) => {
                    follows_clean.push(followed.user);
                });
                //console.log(following);
                return follows_clean;
            })
            .catch((err) => {
                return handleerror(err);
            });
        return {
            following: following,
            followed: followed
        }
    } catch (e) {
        console.log(e);
    }
    return {
        following: following,
        followed: followed
    }

}

const getCounters = (req, res) => {
    let userId = req.user.sub;
    if (req.params.id) {
        userId = req.params.id;
    }
    getCountFollow(userId).then((value) => {
        return res.status(200).send(value);
    })
}

const getCountFollow = async (user_id) => {
    try {
        // Lo hice de dos formas. "following" con callback de countDocuments y "followed" con una promesa
        let following = await Follow.countDocuments({ "user": user_id }, (err, result) => { return result });
        let followed = await Follow.countDocuments({ "followed": user_id }).then(count => count);
        let publications = await
            Publication.count({ "user": user_id })
                .exec().then(count => {
                    return count;
                }).catch((err) => {
                    if (err) return handleError(err);
                });

        return { following, followed, publications }

    } catch (e) {
        console.log(e);
    }


}



// Actualizar datos de usuario
function updateUser(req, res) {
    var userId = req.params.id;
    var update = req.body;

    //sacar pw
    delete update.password;

    if (userId != req.user.sub) {
        return res.status(500).send({ message: 'No tienes permisos para actualizar los datos del usuario' });
    }

    var user_issert = false;
    User.find({
        $or: [
            { email: update.email.toLowerCase() },
            { nick: update.nick.toLowerCase() }
        ]
    }).exec((err, users) => {
        users.forEach((user) => {
            if (user && user._id != userId) {
             user_issert = true;
            }
        });
        if(user_issert) return res.status(404).send({ message: 'Los datos ya estan en uso' });
        User.findByIdAndUpdate(userId, update, { new: true }, (err, userUpdated) => { //new true manda el objeto actualizado (userUpdated)
            if (err) return res.status(500).send({ message: 'Error en la petición' });

            if (!userUpdated) return res.status(404).send({ message: 'No se ha podido actualizar el usuario' });

            return res.status(200).send({ user: userUpdated });
        });

    });

}



// Subir imagen/avatar
function uploadImage(req, res) {
    var userId = req.params.id;


    if (req.files) {
        var file_path = req.files.image.path;
        console.log(file_path);

        var file_split = file_path.split('\\');
        console.log(file_split);

        var file_name = file_split[2];
        console.log(file_name);

        var ext_slit = file_name.split('\.');
        console.log(ext_slit);

        var file_ext = ext_slit[1];
        console.log(file_ext);

        if (userId != req.user.sub) {
            return removeFilesOfUpload(res, file_path, 'No tienes permisos para subir archivo.');
        }

        if (file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif') {
            // Actualizar documento de usuario logueado
            User.findByIdAndUpdate(userId, { image: file_name }, { new: true }, (err, userUpdated) => {
                if (err) return res.status(500).send({ message: 'Error en la petición' });

                if (!userUpdated) return res.status(404).send({ message: 'No se ha podido actualizar el usuario' });

                return res.status(200).send({ user: userUpdated });
            });
        } else {
            return removeFilesOfUpload(res, file_path, 'Extensión no válida.');
        }

    } else {
        return res.status(200).send({ message: 'No se han subido imagenes' })
    }
}

// Eliminar imagen subida
function removeFilesOfUpload(res, file_path, message) {
    fs.unlink(file_path, (err) => {
        return res.status(200).send({ message: message });
    });
}

// Taer Imagen

function getImageFile(req, res) {
    var image_file = req.params.imageFile;
    var path_file = './uploads/users/' + image_file;

    fs.exists(path_file, (exists) => {
        if (exists) {
            res.sendFile(path.resolve(path_file));
        } else {
            res.status(200).send({ message: 'No exixte la imagen...' })
        }
    })
}



module.exports = {
    home,
    pruebas,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    getCounters,
    updateUser,
    uploadImage,
    getImageFile
}