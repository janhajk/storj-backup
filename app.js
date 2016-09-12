var exec = require('child_process').exec;

var list_files = exec("storj list-files", function (error, stdout, stderr) {

  console.log('stdout: ' + stdout);

  console.log('stderr: ' + stderr);

  if (error !== null) {

    console.log('exec error: ' + error);

  }

});