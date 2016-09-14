# storj-backup

This is a package that makes backing up directories to storj simple.

## Installation

    npm install storj-backup -g
    
## Configuration

To configure the backup, you need to pass the binary a JSON configuration file.
There is a sample configuration file supplied in the package (`config.sample.json`).
The file should have the following format:

   {
      "files": {
         "paths": ["/path/to/directory"]
      },
      "storj": {
         "email": "",
         "password": "",
         "bucket": "bucket-id",
         "keypass" = "keypass",
         "concurrency" = 6
      },
   }