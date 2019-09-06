# Tangata Manu Central Flow Visualisation

```
                                            +----------------------+
                                            |                      |
                                            | Tangata Manu Starts  |
                                            |                      |
                                            +-----------+----------+
                                                        |
                                                        |
                                                        |
                                                        v
                                           +------------+--------------+                              +-----------------+
                                           | Abstract "Storage" module |              connect         |                 |
                                           | is initiated from configs +------------------------------+                 |
                                           +------------+--------------+                              |                 |
                                                        |                                             |                 |
                                                        v                                             |                 |
+------------------+                       +------------+--------------+                              |                 |
|                  |        connect        | Abstract "Supplier" module|                              |                 |
|                  +-----------------------+ is initiated from configs |                              |                 |
|                  |                       +---------------------------+                              |     STORAGE     |
|                  +-----+    init         | Abstract "Parser" is also |                              |                 |
|                  |     +-----------------+ initiated for the parser  |                              |                 |
|                  |     |                 +------------+--------------+                              |                 |
|                  |     |                              |                                             |                 |
|                  |     |                              v                                             |                 |
|                  |  P  |                +-------------+---------------+                             |                 |
|                  |  A  |                |  Storage is asked to check  +---------------------------->+                 |
|                  |  R  |                |if the "Genesis" data already|            is_genesis       |                 |
|                  |  S  |                |       were processed        +<----------------------------+                 |
|     SUPPLIER     |  E  |                +--------------------+--------+                             |                 |
|                  |  R  |                              |NO    |   YES                                |                 |
|                  |     |                              v      +-----------+                          |                 |
|                  |     |    get_genesis    +----------+-----------+      |                          |                 |
|                  |     +^------------------+Supplier is asked for |      |                          |                 |
|                  |     +------------------v+the Genesis block data|      |                          |                 |
|                  |     |                   +----------------------+      |                          |                 |
|                  |     |                   |Parsed genesis is sent|    +---+       put_genesis      |                 |
|                  |     |                   |    to the storage    +-------------------------------->+                 |
|                  |     |                   +----------+-----------+    +---+                        |                 |
|                  |     |                              |                  |                          |                 |
|                  |     |                              v <----------------+                          |                 |
|                  |     |             +----------------+-----------------+                           |                 |
|                  |     |             | Storage is asked to provide the  +-------------------------->+                 |
|                  |     |             | current synchronisation status,  |            get_tip        |                 |
|                  |     |             |like the last processed block, etc+<--------------------------+                 |
|                  |     |             +---------------+------------------+                           |                 |
|                  |     |                             |            ^-------------------------+       |                 |
|                  |     |                             v                                      |       |                 |
|                  |     |           +-----------------+--------------------+                 |       |                 |
|                  |     | get_block |Supplier is asked to provide the block|                 |       |                 |
|                  |     +^----------+at height (tip + 1), and it either    |                 |       |                 |
|                  |     +----------v+exists right now or not               |                 |       |                 |
|                  |     |           +-+---------+-----------------+--------+                 |       |                 |
+------------------+-----+             ^         |                 |                          |       |                 |
                                       |         |IF NO            |IF YES                    |       |                 |
                                       |         |                 |                          |       |                 |
                     +-----------------+---+     |                 v                          |       |                 |
                     | Sleep for some time +<----+     +-----------+-------------+            |       |                 |
                     |                     |           |Check if block.parentHash|            |       |                 |
                     +-------+-------------+           |matches our latest known |            |       |                 |
                             ^                         |processed block hash     |            |       |                 |
                             |               IF YES    +-------------------------+            |       |                 |
                             |             +--------------+        |IF NO                     |       |                 |
                             |             |                       v                          |       |                 |
                             |             |     +-----------------+--------------------+   +-+-+     |                 |
                             |             |     |Command storage to erase last N blocks| roll_back_N |                 |
                             |             |     |from history (where N is a configured +------------>+                 |
                             |             |     |constant "rollback number")           |   +---+     |                 |
                             |             |     +--------------------------------------+     ^       |                 |
                             |             |     |Restart synchronisation               +-----+       |                 |
                             |             |     |from earlier point                    |             |                 |
                             |             |     +--------------------------------------+             |                 |
                             |             |                                                          |                 |
                             |             |     +-------------------------------+                    |                 |
                             |             +---->+Send parsed block to storage   |     store_block    |                 |
                             |                   |so it can process it in any way+------------------->+                 |
                             |                   |it wants                       |                    |                 |
                             |                   +---------------+---------------+                    +-----------------+
                             |                                   |
                             |                                   |
                             +-----------------------------------+
```

# Notes

Note that this visualisation intentionally omits any details on the internals of "Storage" and "Supplier" components, because they (although being a big part of the actual codebase) are non-importan to the central flow, which is the main idea behind the "Tangata Manu" and its universality.

Different storages might implement operations differently, for example, the existing default "Postgres Wallet" implementation manages the UTxO state and has to handle its integrity during a rollback, but upcoming alternative Elasticsearch storage only collects historical blocks and transactions in "append only" manner, but also adds its own unique kinds of aggregations, not suitable for Postgres.

In the same way different chain data suppliers can utilize their own unique quirks, specific only to their underlying components. For example, current default "Rust Bridge" supplier is based on [cardano-http-bridge](https://github.com/Emurgo/cardano-http-bridge) node, which uniquely supports downloading full historical epochs as a single file, and the supplier uses this feature to make historical syncing easier and faster. But alternative suppliers in the future (e.g. Cardano-SL supplier, or Jormungandr, etc) might not support this particular feature and therefore will implement functionality differently.

Parsers are represented as being a separate component, rather than a part of the supplier, because they might be reusable in some cases. E.g. if two different node implementations support exporting data in the native Cardno binary format (raw data) - the same parses can be used on top of it, so only, basically, the network layer will be different in this case.

We at Emurgo plan to try and support at least all official node implementattions as alternative suppliers eventually, and at the moment we are actively working on not only creating multiple alternative storage implementations (alternative on both the underlying storage used, but also in the schema and the kind of stored data), but also on making **the process** of adding an alterantive storage as easy and painless as possible, so hopefully at any point anyone could PR a new implementation and make the codebase even more diverse and universally useful.
