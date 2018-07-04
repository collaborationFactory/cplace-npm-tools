var gulp = require('gulp'),
  tsc = require('gulp-typescript'),
  tslint = require('gulp-tslint'),
  sourcemaps = require('gulp-sourcemaps'),
  del = require('del'),
  tsProject = tsc.createProject('tsconfig.json'),
  mocha = require('gulp-mocha'),
  path = require('path'),
  rename = require('gulp-rename');
// or requiring in ES5
var tslint = require("gulp-tslint");
var merge = require('merge2');
var shell = require('gulp-shell');

gulp.task('ts-lint', ['clean-ts'], function () {
  return gulp
    .src(['./**/*.ts', '!typings/**/*.ts', '!node_modules/**/*.ts'])
    .pipe(tslint({
      formatter: "prose"
    }))
    .pipe(tslint.report());
});

/**
 * Compile TypeScript and include references to library and app .d.ts files.
 */
gulp.task('compile-ts', function () {
  var tsResult = tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject());

  return merge([
    tsResult.dts.pipe(gulp.dest('dist')),
    tsResult.js
      .pipe(sourcemaps.write('.', {
        // Return relative source map root directories per file.
        includeContent: false,
        sourceRoot: function (file) {
          var sourceFile = path.join(file.cwd, file.sourceMap.file);
          return "../" + path.relative(path.dirname(sourceFile), __dirname);
        }
      }))
      .pipe(gulp.dest('dist'))
  ]);
});

gulp.task('copy-json', ['compile-ts'], function () {
  var sourceJsonFiles = [
    './src/*.json',                //path to typescript files
  ];

  return gulp.src(sourceJsonFiles).pipe(gulp.dest('dist/src/'));
});

gulp.task('clean-ts', function (cb) {
  var typeScriptGenFiles = [
    './dist/**/*.*'    // path to all JS files auto gen'd by editor
  ];

  // delete the files
  return del(typeScriptGenFiles, cb);
});

gulp.task('test', ['ts-lint', 'copy-json'], function () {
  return gulp
    .src('dist/test/**/*.spec.js', {read: false})
    // gulp-mocha needs filepaths so you can't have any plugins before it
    .pipe(mocha({reporter: 'spec', timeout: '360000'}))
    .once('error', function () {
      process.exit(1);
    });
});

gulp.task('pack', ['test'], shell.task([
  'npm pack'
]));

/**
 * Watch *.ts files and recompile them on modification.
 */
gulp.task('watch', ['clean-ts', 'compile-ts'],function() {
  gulp.watch('src/**/*.ts', ['compile-ts']);
});

gulp.task('default', ['clean-ts', 'ts-lint', 'compile-ts', 'copy-json', 'test']);
