#!/usr/bin/env node

/* Dependencies */
var cli = require('cli'),
   path = require('path'),
   util = require('util'),
   pkg = require('../package.json'),
   backup = require('../index.js');

cli.enable('version').setApp(pkg.name, pkg.version).setUsage(cli.app + ' [OPTIONS] <path to json config>');
var options = cli.parse({
   now: ['n', 'Run sync on start']
});

if(cli.args.length !== 1) {
   return cli.getUsage();
}

/* Configuration */
// The process.cwd() method returns the current working directory of the Node.js process.
// cli.args[0] = <path to json config>
var configPath = path.resolve(process.cwd(), cli.args[0]);
backup.log('Loading config file (' + configPath + ')');
var config = require(configPath);

/* Start sync */
if(options.now) {
   backup.sync(config.files, config.storj, function(err) {
      process.exit(err ? 1 : 0);
   });
}