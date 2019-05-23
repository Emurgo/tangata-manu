{
  "appName": "yoroi-importer",
  "cardanoBridge": {
    "baseUrl": "${CARDANO_API_URL}",
    "template": "${CARDANO_NETWORK}"
  },
  "server": {
    "port": 8080,
    "logLevel": "debug",
    "logRequests": "true",
    "apiConfig": {
      "addressesRequestLimit": 50,
      "txsHashesRequestLimit": 150,
      "txHistoryResponseLimit": 20,
      "txHistoryV2ResponseLimit": 50,
      "minimumTimeImporterHealthCheck": 90000
    }
  },
  "checkTipCronTime": "0 */1 * * * *",
  "defaultNetwork": "${CARDANO_NETWORK}",
  "defaultBridgeUrl": "${CARDANO_API_URL}",
  "networks": {
    "obft-testnet": {
      "genesis": "791f4256e14c67b9035c3b80a0826adf719d3636c18eef16c98b84b833723d51",
      "bridgeUrl": "${CARDANO_API_URL}",
      "startTime": 1544614190
    },
    "staging": {
      "genesis": "c6a004d3d178f600cd8caa10abbebe1549bef878f0665aea2903472d5abf7323",
      "bridgeUrl": "${CARDANO_API_URL}",
      "startTime": 1506450213
    },
    "testnet": {
      "genesis": "b7f76950bc4866423538ab7764fc1c7020b24a5f717a5bee3109ff2796567214",
      "bridgeUrl": "${CARDANO_API_URL}",
      "startTime": 1537941600
    },
    "mainnet": {
      "genesis": "5f20df933584822601f9e3f8c024eb5eb252fe8cefb24d1317dc3d432e940ebb",
      "startTime": 1506203091
    }
  }
}
