var sys = require('sys');
var exec = require('child_process').exec;

var child = exec("storj info", function (error, stdout, stderr) {

  sys.print('stdout: ' + stdout);

  sys.print('stderr: ' + stderr);

  if (error !== null) {

    console.log('exec error: ' + error);

  }

});