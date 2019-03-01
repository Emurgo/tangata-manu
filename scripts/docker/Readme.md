# About

This scripts can be used to:

* Build a docker image
* Launch the container in staging

_Note: this is a first version, the process should be improved_

## Build a docker image

1.  Checkout the corresponding branch
2.  As docker image tag will be set as the package.json version field, if necessary, bump
    the version number
3.  In $PROJECT_ROOT folder, run `sudo npm run build-docker`
4.  A new image in the repository `icarus/icarus-poc-backend-service` with tag `version`
    will be created

**Important: If there is already an image with the same version number, it will overwrite it**

## Deploy in staging

1.  Access (ssh) into the server
2.  Checkout branch to deploy
3.  Execute [build](# Build a docker image)
4.  In the $PROJECT_ROOT folder, run `sudo npm run launch-staging -- "$VERSION"` where `$VERSION`
    corresponds to the one generated in build step.

### Important Note about staging config

Staging database configuration (or any other sensitive information) **will never be pushed**
to the repository. In order to be able to configure it we will use environment variables.

To do so, there is a file `$PROJECT_ROOT/config/custom-environment-variables.json` where
the mapping to `node-config` library is defined. In the server, this enviroment variables
are loaded from `~/icarus-backend-staging-env` so that file must exist and look like:

```
export DB_USER=the_user
export DB_HOST=the_host
export DB=the_db
export DB_PASSWORD=the_password
export DB_PORT=the_port
```
