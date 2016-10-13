var
  fs = require('fs'),
  fse = require('fs-extra'),
  path = require('path'),
  files = require('./files.js'),
  config = require('./schemas/config'),
  schema = require('./schema.js'),
  metadata = require('./metadata.js'),
  manifest = require('./manifest.js');

var _logSuccess = function(msg) {
  var date = new Date;
  var time = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
  console.log('[' + time + ']', 'SCORM', "'" + '\x1b[32m' + msg + '\x1b[0m' + "'");
};

var _logError = function(err) {
  var date = new Date;
  var time = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
  console.log('[' + time + ']' + '\x1b[31m', err, '\x1b[0m');
};

var buildPackage = function(obj, callback) {
  obj = config(obj);
  var
    schemaVersion,
    schemaDefinition;

  switch (obj.version) {
    case '1.2':
      schemaVersion = 'scorm12';
      schemaDefinition = 'scorm12edition';
      break;
    case '2004 3rd Edition':
      schemaVersion = 'scorm2004';
      schemaDefinition = 'scorm20043rdedition';
      break;
    case '2004 4th Edition':
      schemaVersion = 'scorm2004';
      schemaDefinition = 'scorm20044thedition';
      break;
  }

  if (!schemaVersion) {
    callback('Supported versions:\n1.2\n2004 3rd Edition\n2004 4th Edition');
    return;
  }

  var
    rootDir = path.dirname(fs.realpathSync(__filename)),
    definitionFileList = files(path.join(rootDir, 'schemas', 'definitionFiles', schemaDefinition))
    .map(function(file) {
      return {
        name: file,
        source: path.join(rootDir, 'schemas', 'definitionFiles', schemaDefinition, file),
        destination: path.join(obj.source, file)
      }
    });

  fse.outputFile(path.join(obj.source, 'imsmanifest.xml'), manifest(schemaVersion, obj), function(err) {
    if (err) {
      return _logError(err);
    } else {
      _logSuccess('create '+path.join(obj.source, 'imsmanifest.xml'));
      fse.outputFile(path.join(obj.source, 'metadata.xml'), metadata(obj), function(err) {
        if (err) {
          return _logError(err);
        } else {
          _logSuccess('create '+path.join(obj.source, 'metadata.xml'));
          definitionFileList.forEach(function(file) {
            try {
              fse.copySync(file.source, file.destination);
              _logSuccess('create '+file.destination);
            } catch (err) {
              _logError(err);
            }
          });
          if (obj.package.zip) {
            var archiver = require('archiver');
            fse.ensureDirSync('./scorm');
            var zipOutput = path.join(obj.package.output, obj.package.name+"_"+obj.package.version+"_"+obj.package.date+".zip");
            _logSuccess('Archiving '+obj.source+' to '+zipOutput);
            var output = fs.createWriteStream(zipOutput);
            var archive = archiver('zip');
            output.on('close', function() {
              _logSuccess(obj.package.name+"_"+obj.package.version+"_"+obj.package.date+".zip "+archive.pointer() + ' total bytes');
              callback('Done');
            });
            archive.on('error', function(err) {
              _logError(err);
              throw err;
            });
            archive.pipe(output);
            archive.bulk([{
              expand: true,
              cwd: obj.source,
              src: ['**/*'],
              dest: ""
            }]);
            archive.finalize();
          } else {
            callback('Done');
          }
        }
      });
    }
  });


};

module.exports = buildPackage;