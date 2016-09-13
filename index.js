var fs = require('fs');
var async = require('async');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var path = require('path');
var glob = require('glob');
var crypto = require('crypto');


/**
 * log
 *
 * Logs a message to the console with a tag.
 *
 * @param message  the message to log
 * @param tag      (optional) the tag to log with.
 */

var log = function(message, tag) {
  var color, currentTag, tags, util;
  util = require('util');
  color = require('cli-color');
  tag = tag || 'info';
  tags = {
    error: color.red.bold,
    warn: color.yellow,
    info: color.cyanBright
  };
  currentTag = tags[tag] || function(str) {
    return str;
  };
  util.log((currentTag('[' + tag + '] ') + message).replace(/(\n|\r|\r\n)$/, ''));
};


/**
 * getArchiveName
 *
 * Returns the archive name in name_YYYY_MM_DD.tar.gz format.
 *
 * @param name   The name of the backup
 */

var getArchiveName = function(name) {
  return name +'_' + (new Date().toISOString().slice(0, -5).replace(/[^T0-9]/g, '-')) + '.tar.gz';
};


/* removeRF
 *
 * Remove a file or directory. (Recursive, forced)
 *
 * @param target       path to the file or directory
 * @param callback     callback(error)
 */

var removeRF = function(target, callback) {
  callback = callback || function() {};
  fs.exists(target, function(exists) {
    if (!exists) {
      return callback(null);
    }
    log('Removing ' + target, 'info');
    exec('rm -rf ' + target, callback);
  });
};


/* mkdir
 *
 * Creates a directory.
 *
 * @param target       path to the new directory
 * @param callback     callback(error)
 */

var mkdir = function(target, callback) {
  callback = callback || function() {};
  fs.exists(target, function(exists) {
    if (!exists) {
      log('Creating folder ' + target, 'info');
      exec('mkdir ' + target, function() {
        return callback();
      });
    }
  });
};

/**
 * compressDirectory
 *
 * Compressed the directory so we can upload it to storj.
 *
 * @param directory  current working directory
 * @param input     path to input file or directory
 * @param output     path to output archive
 * @param callback   callback(err)
 */

var compressDirectory = function(cwd, input, output, callback) {
  var tar, tarOptions;
  tar = void 0;
  tarOptions = void 0;
  callback = callback || function() {};
  tarOptions = ['--force-local', '-zcf', output, input];
  log('Starting compression of ' + input + ' into ' + output, 'info');
  tar = spawn('tar', tarOptions, {
    cwd: cwd
  });
  tar.stderr.on('data', function(data) {
    return log(data, 'error');
  });
  tar.on('exit', function(code) {
    if (code === 0) {
      log('Successfully compressed', 'info');
      return callback(null);
    } else {
      return callback(new Error('Tar exited with code ' + code));
    }
  });
};

var compressFiles = function(cwd, files, output, callback) {
  var file, i, len, tar, tarOptions;
  tar = void 0;
  tarOptions = void 0;
  callback = callback || function() {};
  tarOptions = ['--no-recursion', '--force-local', '-zcf', output, '-T', '-'];
  log('Starting compression of ' + files.length + ' files into ' + output, 'info');
  tar = spawn('tar', tarOptions, {
    cwd: cwd
  });
  for (i = 0, len = files.length; i < len; i++) {
    file = files[i];
    if (file[0] === '-') {
      tar.stdin.write('--add-file=');
    }
    tar.stdin.write(file + '\n');
  }
  tar.stdin.end();
  tar.stderr.on('data', function(data) {
    return log(data, 'error');
  });
  tar.on('exit', function(code) {
    if (code === 0) {
      log('Successfully compressed', 'info');
      return callback(null);
    } else {
      return callback(new Error('Tar exited with code ' + code));
    }
  });
};


/**
 * sendToStorj
 *
 * Sends a file or directory to Storj.
 *
 * @param options   storj options [key, secret, bucket]
 * @param directory directory containing file or directory to upload
 * @param target    file or directory to upload
 * @param callback  callback(err)
 */

var sendToStorj = function(options, directory, target, callback) {
   var storj = require('storj');
   var fs = require('fs');

   callback = callback || function() {};

   // Paths
   var sourceFile = path.join(directory, target);
   var destination = options.destination || '/';
   destination = (function(d) {d[0]=='/'||(d='/'+d);d.slice(-1)=='/'||(d+='/');return d})(destination);// make shure path is "/path/"
   var destinationFile = destination + target;
   var tmppath = sourceFile + '.crypt';

   var keypair = storj.KeyPair(fs.readFileSync(options.privatekey).toString());
   var keyring = storj.KeyRing('./', options.keypass);
   var secret = new storj.DataCipherKeyIv();
   var encrypter = new storj.EncryptStream(secret);

   var storjClient = storj.storj.BridgeClient('https://api.storj.io', {
      keypair: keypair,
      concurrency: options.concurrency // Set upload concurrency
   });
   console.log('Attemping to upload ' + sourceFile + ' to the ' + options.bucket + ' storj-bucket into ' + destinationFile);
   //Encrypt the file to be uploaded and store it temporarily
   fs.createReadStream(sourceFile).pipe(encrypter).pipe(fs.createWriteStream(tmppath)).on('finish', function() {
      // Create token for uploading to bucket by bucketid
      storjClient.createToken(options.bucket, 'PUSH', function(err, token) {
         if(err) {
            console.log('error', err.message);
         }
         // Store the file using the bucket id, token, and encrypted file
         storjClient.storeFileInBucket(options.bucket, token.token, tmppath, function(err, file) {
            if(err) {
               return callback(err.message);
            }
            // Save key for access to download file
            keyring.set(file.id, secret);
            console.log('info', 'Name: %s, Type: %s, Size: %s bytes, ID: %s', [file.filename, file.mimetype, file.size, file.id]);
            return callback(false, file);
         });
      });
   });
   };


/**
 * sync
 *
 * gzips the data and uploads it to storj bucket.
 *
 * @param storjConfig     storj config [key, secret, bucket]
 * @param callback        callback(err)
 */

var sync = function(filesConfig, storjConfig, callback) {
   var tmpDir = path.join(require('os').tmpDir(), 'storj_backup_' + crypto.randomBytes(8).toString('hex'));
   console.log(tmpDir);
   var filesArchiveName = getArchiveName('files');
   var files = [];
   callback = callback || function() {};
   return async.series([
      function(cb) {
         return mkdir(tmpDir, function(err) {
            return cb(err);
         });
      },
      function(cb) {
         return async.map(filesConfig.paths, glob, function(err, filesList) {
            var ref;
            if(err) {
               return cb(err);
            }
            files = (ref = []).concat.apply(ref, filesList);
            if(!files.length) {
               log("No files matched!", "warning");
            }
            return cb();
         });
      },
      function(cb) {
         if(!files.length) {
            return cb();
         }
         return compressFiles('./', files, tmpDir + '/' + filesArchiveName, cb);
      },
      function(cb) {
         var e, error;
         try {
            return async.parallel([
               function(cb) {
                  if(!files.length) {
                     return cb();
                  }
                  return sendToStorj(storjConfig, tmpDir, filesArchiveName, function(err) {
                     return cb(err);
                  });
               }
            ], function(err) {
               return cb(err);
            });
         } catch(error) {
            e = error;
            return cb(e);
         }
      }
   ], function(err) {
      if(err) {
         log(err, 'error');
      } else {
         log('Successfully done');
      }
      return removeRF(tmpDir, function(moreErr) {
         return callback(err || moreErr);
      });
   });
};

module.exports = {
  sync: sync,
  log: log
};