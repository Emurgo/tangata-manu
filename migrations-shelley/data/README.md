# Data files used in the DB schema migrations

## known-legacy-addresses-byron-mainnet.txt

### Git LFS

Note that this file is too large to keep it in a regular GitHub repository, so we are using Git LFS.

When you are checking out the repository - you need to manually download the file or install a special tool to properly sync it.

See: [https://git-lfs.github.com/](https://git-lfs.github.com/) 

### Purpose

This file contains a dump of all distinct addresses ever used on the Cardano Byron mainnet before the Shelley snapshot.

Shelley network is initialized with the full UTxO snapshot from the Byron network, so all the funds are transferred, but technically it is possible that for some wallet N first addresses were empty and then only address N+1 contained a UTxO, and N is greater than the [address gap limit according to the BIP44 standard](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit). In this case a BIP44 wallet would fail to recognize the UTxO.

To solve this problem we are storing the set of all used legacy addresses, so the wallet can check if any of first 20 addresses were ever used, and see that next 20 must be generated. That way all the UTxOs must be properly detected by their wallets.
