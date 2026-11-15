// Adapt historical /tmp fixture reads without copying into a drive root.
const fs=require('node:fs'),path=require('node:path');
const root=process.env.SNOWFLAKE_FIXTURES||path.resolve(__dirname,'../../fixtures'),read=fs.readFileSync;
fs.readFileSync=function(file,...args){if(typeof file==='string'&&file.startsWith('/tmp/'))file=path.join(root,path.basename(file));return read.call(this,file,...args)};
const target=process.argv[2];if(!target)throw Error('Usage: node tests/run-with-fixtures.cjs tests/<suite>.cjs [options]');
process.argv.splice(1,1);require(path.resolve(target));
