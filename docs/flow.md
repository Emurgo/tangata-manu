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
                                                    +------------+--------------+                                      +-----------------+
                                                    | Abstract "Storage" module |              connect                 |                 |
                                                    | is initiated from configs +--------------------------------------+                 |
                                                    +------------+--------------+                                      |                 |
                                                                 |                                                     |                 |
                                                                 v                                                     |                 |
+------------------+                                +------------+--------------+                                      |                 |
|                  |             connect            | Abstract "Supplier" module|                                      |                 |
|                  +--------------------------------+ is initiated from configs |                                      |                 |
|                  |                                +---------------------------+                                      |     STORAGE     |
|                  +-----+        init              | Abstract "Parser" is also |                                      |                 |
|                  |     +--------------------------+ initiated for the parser  |                                      |                 |
|                  |     |                          +------------+--------------+                                      |                 |
|                  |     |                                       |                                                     |                 |
|                  |     |                                       v                                                     |                 |
|                  |  P  |                         +-------------+---------------+                                     |                 |
|                  |  A  |                         |  Storage is asked to check  +------------------------------------>+                 |
|                  |  R  |                         |if the "Genesis" data already|            is_genesis               |                 |
|                  |  S  |                         |       were processed        +<------------------------------------+                 |
|     SUPPLIER     |  E  |                         +--------------------+--------+                                     |                 |
|                  |  R  |                                       |NO    |   YES                                        |                 |
|                  |     |                                       v      +-----------+                                  |                 |
|                  |     |      get_genesis           +----------+-----------+      |                                  |                 |
|                  |     +^---------------------------+Supplier is asked for |      |                                  |                 |
|                  |     +---------------------------v+the Genesis block data|      |                                  |                 |
|                  |     |                            +----------------------+      |                                  |                 |
|                  |     |                            |Parsed genesis is sent|    +---+       put_genesis              |                 |
|                  |     |                            |    to the storage    +---------------------------------------->+                 |
|                  |     |                            +----------+-----------+    +---+                                |                 |
|                  |     |                                       |                  |                                  |                 |
|                  |     |                                       v <----------------+                                  |                 |
|                  |     |                      +----------------+-----------------+                                   |                 |
|                  |     |                      | Storage is asked to provide the  +---------------------------------->+                 |
|                  |     |                      | current synchronisation status,  |            get_tip                |                 |
|                  |     |                      |like the last processed block, etc+<----------------------------------+                 |
|                  |     |                      +---------------+------------------+                                   |                 |
|                  |     |                                      |            ^----------------------------+            |                 |
|                  |     |                                      v                                         |            |                 |
|                  |     |                    +-----------------+--------------------+                    |            |                 |
|                  |     |     get_block      |Supplier is asked to provide the block|                    |            |                 |
|                  |     +^-------------------+at height (tip + 1), and it either    |                    |            |                 |
|                  |     +-------------------v+exists right now or not               |                    |            |                 |
|                  |     |                    +-+---------+-----------------+--------+                    |            |                 |
+------------------+-----+                      ^         |                 |                             |            |                 |
                                                |         |IF NO            |IF YES                       |            |                 |
                                                |         |                 |                             |            |                 |
                              +-----------------+---+     |                 v                             |            |                 |
                              | Sleep for some time +<----+     +-----------+-------------+               |            |                 |
                              |                     |           |Check if block.parentHash|               |            |                 |
                              +-------+-------------+           |matches our latest known |               |            |                 |
                                      ^                         |processed block hash     |               |            |                 |
                                      |               IF YES    +-------------------------+               |            |                 |
                                      |             +--------------+        |IF NO                        |            |                 |
                                      |             |                       v                             |            |                 |
                                      |             |     +-----------------+--------------------+      +-+-+          |                 |
                                      |             |     |Command storage to erase last N blocks|    roll_back_N      |                 |
                                      |             |     |from history (where N is a configured +-------------------->+                 |
                                      |             |     |constant "rollback number")           |      +---+          |                 |
                                      |             |     +--------------------------------------+        ^            |                 |
                                      |             |     |Restart synchronisation               +--------+            |                 |
                                      |             |     |from earlier point                    |                     |                 |
                                      |             |     +--------------------------------------+                     |                 |
                                      |             |                                                                  |                 |
                                      |             |     +-------------------------------+                            |                 |
                                      |             +---->+Send parsed block to storage   |     store_block            |                 |
                                      |                   |so it can process it in any way+--------------------------->+                 |
                                      |                   |it wants                       |                            |                 |
                                      |                   +---------------+---------------+                            +-----------------+
                                      |                                   |
                                      |                                   |
                                      +-----------------------------------+
```
