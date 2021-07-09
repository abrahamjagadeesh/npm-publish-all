#!/usr/bin/env node

'use strict';

var argv = require('yargs')
  .usage('Usage: npm-publish-all bump --bumpType [string]')
  .example('npm-publish-all bump', 'Only Bump version  \n')
  .example('npm-publish-all bump --bumpType=major', 'Bump version to major \n')
  .example('npm-publish-all bump --bumpType=2.0.0', 'Bump version to a number \n')
  .example('npm-publish-all bump --exclude=bin cmd', 'excludes any folders like node_modules \n')
  .example('npm-publish-all bump --include=glob react webpack', 'includes only these folder \n')
  .example('npm-publish-all bump --versionArgs="--force"', 'any options that the npm version command takes \n')
  .example('npm-publish-all bump --context=subDirectory', 'when you want to run the commands in a sub directory \n')
  .example('npm-publish-all publish', 'Only publish the module \n')
  .example('npm-publish-all publish --exclude=bin cmd\n')
  .example('npm-publish-all publish --publishArgs="--tag alpha"', 'any options that the npm publish command takes \n')
  .example('npm-publish-all publish --context=subDirectory --exclude=bin \n')
  .example('npm-publish-all both', 'Bump the version and publish as well \n')
  .example('npm-publish-all both --context subDirectory --exclude=bin \n')
  .options({
    'bumpType': {
      default: 'patch',
      describe: 'Bump types: <newversion>|major|minor|patch|premajor|preminor|prepatch|prerelease|from-git',
      type: 'string'
    },
    'exclude': {
      default: [],
      describe: 'List of modules to exclude, leave space between inputs',
      type: 'array'
    },
    'include': {
      default: [],
      describe: 'List of modules to include, leave space between inputs',
      type: 'array'
    },
    'context': {
      describe: 'Change the context to a sub-directory',
      type: 'string'
    },
    'versionArgs': {
      default: '',
      describe: 'Any extra arguments that `npm version` command take',
      type: 'string'
    },
    'publishArgs': {
      default: '',
      describe: 'Any extra arguments that `npm publish` command take',
      type: 'string'
    }
  })
  .global('exclude')
  .global('include')
  .global('context')
  .global('bumpType')
  .global('versionArgs')
  .global('publishArgs')
  .command('bump', "Bump every modules based on the bumpType")
  .command('publish', "Publish every modules; takes publishArgs as option")
  .command('both', "Bump the version and publish every modules")
  .demandCommand(1, "One command is required from bump|publish|both")
  .wrap(90)
  .help()
  .strict()
  .argv;


const fs = require('fs-extra');
const path = require('path');
const rootDir = process.cwd();

//command
let command = argv._.pop();

// exclude directories
let exclude = ['node_modules'].concat(argv.exclude);
let include = argv.include;

// change the context to a sub directory
if (argv.context) {
  process.chdir(path.join(rootDir, argv.context));
}

let fn = require('../index');
let bumpVersion = fn.bumpVersion;
let publish = fn.publish;

// walk the directories
Walk();

function Walk() {

  //current working directory
  //context might have changed
  let currentDir = process.cwd();

  processDir(currentDir);

  function processDir(dir) {
  // console.log("processing dir: " + dir);
  fs.readdir(dir, function (err, files) {

    if (err) {
      console.error("Error in reading directories", err);
      return;
    }

    files.map(function (file) {
      // console.log("Reading stat for file: " + file);
      let fullFilePath = path.join(dir, file);
      fs.stat(fullFilePath, function (e, stats) {

        if (e) {
          console.error("Error in reading stats", e);
          return;
        }


        //if, a directory is and included or not excluded
        if (stats.isDirectory() && ((include.length && include.indexOf(file)>=0)||(!include.length && exclude.indexOf(file)<0) )) {

          let pathToDir = fullFilePath;
          let isModule = fs.existsSync(path.join(pathToDir, 'package.json'));

          if (!isModule) {
            console.warn("Folder " + file + "/ is not a Node module, trying jump in");
            // process.chdir(pathToDir);
            processDir(pathToDir);
            return;
          }

          /**
           * @param pathToDir {string} publish the module in this path
           */
          function _publishModule(pathToDir) {
            //console.log("Publishing " + pathToDir);
            publish(pathToDir, argv.publishArgs).then((data) => {
              console.log(`Published module: ${data.stdout}`);
            }).catch((err) => {
              console.error(`Error while publishing: ${err}`);
            });
          }

          //when command bump or both, bump the version
          if (/^(bump|both)$/.test(command)) {
            bumpVersion(pathToDir, argv.bumpType, argv.versionArgs)
              .then((data) => {
                let name = path.basename(data.pathToDir);
                console.log(`${name}\'s version changed to ${data.stdout}`);

                // if both
                // publish once bumped version
                if (command === 'both') _publishModule(data.pathToDir);
              }).catch((err) => {
                console.error(`Error while patching: ${err}`);
              });
          } else if (command === 'publish') {
            //only publish
            _publishModule(pathToDir);
          }
        };
      });
    });
  });
}
}
