var gulp = require('gulp');

var babelify = require('babelify');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var bump = require('gulp-bump');
var git = require('gulp-git');
var gitModified = require('gulp-gitmodified');
var glob = require('glob');
var helpers = require('babelify-external-helpers');
var jasmine = require('gulp-jasmine');
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var runSequence = require('run-sequence');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var util = require('gulp-util');

var fs = require('fs');

function getVersionFromPackage() {
    return JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
}

function getVersionForComponent() {
    return getVersionFromPackage().split('.').slice(0, 2).join('.');
}

gulp.task('ensure-clean-working-directory', function() {
    return gulp.src('./**/*')
        .pipe(gitModified('M', 'A', 'D', 'R', 'C', 'U', '??'))
        .on('data', function (file) {
            if (file) {
                throw new Error('Unable to proceed, your working directory is not clean.');
            }
        });
});

gulp.task('bump-version', function () {
    return gulp.src([ './package.json', './bower.json' ])
        .pipe(bump({ type: 'patch' }).on('error', util.log))
        .pipe(gulp.dest('./'));
});

gulp.task('embed-version', function () {
    var version = getVersionFromPackage();

    return gulp.src(['./lib/alerts/index.js'])
        .pipe(replace(/(version:\s*')([0-9]+\.[0-9]+\.[0-9]+)(')/g, '$1' + version + '$3'))
        .pipe(gulp.dest('./lib/alerts/'));
});

gulp.task('commit-changes', function () {
    return gulp.src([ './', './dist/' ])
        .pipe(git.add())
        .pipe(gitModified('M', 'A'))
        .pipe(git.commit('Release. Bump version number'));
});

gulp.task('push-changes', function (cb) {
    git.push('origin', 'master', cb);
});

gulp.task('create-tag', function (cb) {
    var version = getVersionFromPackage();

    git.tag(version, 'Release ' + version, function (error) {
        if (error) {
            return cb(error);
        }

        git.push('origin', 'master', { args: '--tags' }, cb);
    });
});

gulp.task('build-browser', function() {
    return browserify('./lib/index.js', { standalone: 'Barchart.Alerts' })
        .transform('babelify', {presets: ['es2015']})
        .bundle()
        .pipe(source('barchart-alerts-api.js'))
        .pipe(buffer())
        .pipe(gulp.dest('./dist'))
        .pipe(rename('barchart-alerts-api-' + getVersionForComponent() + '.js'))
        .pipe(gulp.dest('./dist'))
        .pipe(uglify())
        .pipe(rename('barchart-alerts-api-' + getVersionForComponent() + '-min.js'))
        .pipe(gulp.dest('dist/'));
});

gulp.task('build', [ 'build-browser' ]);

gulp.task('build-browser-tests', function () {
    return browserify({ entries: glob.sync('test/specs/**/*.js') })
        .transform('babelify', {presets: ['es2015']})
        .bundle()
        .pipe(source('barchart-alerts-api-tests.js'))
        .pipe(buffer())
        .pipe(gulp.dest('test/dist'));
});

gulp.task('execute-browser-tests', function () {
    return gulp.src('test/dist/barchart-alerts-api-tests.js')
        .pipe(jasmine());
});

gulp.task('execute-node-tests', function () {
    return gulp.src(['lib/index.js', 'test/specs/**/*.js'])
        .pipe(jasmine());
});

gulp.task('execute-tests', function (callback) {
    runSequence(
        'build-browser-tests',
        'execute-browser-tests',
        'execute-node-tests',

        function (error) {
            if (error) {
                console.log(error.message);
            }

            callback(error);
        });
});

gulp.task('test', [ 'execute-tests' ]);

gulp.task('release', function (callback) {
    runSequence(
        'ensure-clean-working-directory',
        'bump-version',
        'embed-version',
        'build',
        'build-browser-tests',
        'execute-browser-tests',
        'execute-node-tests',
        'commit-changes',
        'push-changes',
        'create-tag',

        function (error) {
            if (error) {
                console.log(error.message);
            } else {
                console.log('Release complete');
            }

            callback(error);
        });
});

gulp.task('lint', function() {
    return gulp.src([ './lib/**/*.js', './test/specs/**/*.js' ])
        .pipe(jshint({'esversion': 6}))
        .pipe(jshint.reporter('default'));
});

gulp.task('default', [ 'lint' ]);