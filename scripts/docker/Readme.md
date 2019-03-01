# About

This scripts can be used to:

* Build a docker image
* Launch the container in staging

_Note: this is a first version, the process should be improved_

## Build a docker image

1.  Checkout the corresponding branch
2.  As docker image tag will be set as the package.json version field, if necessary, bump
    the version number
3.  In $PROJECT_ROOT folder, run `yarn run build-docker`
4.  A new image in the repository `yoroi/yoroi-importer` with tag `version`
    will be created

**Important: If there is already an image with the same version number, it will overwrite it**
