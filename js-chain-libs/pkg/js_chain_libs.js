let wasm;
const { TextDecoder } = require(String.raw`util`);

let WASM_VECTOR_LEN = 0;

let cachegetNodeBufferMemory = null;
function getNodeBufferMemory() {
    if (cachegetNodeBufferMemory === null || cachegetNodeBufferMemory.buffer !== wasm.memory.buffer) {
        cachegetNodeBufferMemory = Buffer.from(wasm.memory.buffer);
    }
    return cachegetNodeBufferMemory;
}

function passStringToWasm(arg) {

    const len = Buffer.byteLength(arg);
    const ptr = wasm.__wbindgen_malloc(len);
    getNodeBufferMemory().write(arg, ptr, len);
    WASM_VECTOR_LEN = len;
    return ptr;
}

let cachegetInt32Memory = null;
function getInt32Memory() {
    if (cachegetInt32Memory === null || cachegetInt32Memory.buffer !== wasm.memory.buffer) {
        cachegetInt32Memory = new Int32Array(wasm.memory.buffer);
    }
    return cachegetInt32Memory;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

let cachegetUint8Memory = null;
function getUint8Memory() {
    if (cachegetUint8Memory === null || cachegetUint8Memory.buffer !== wasm.memory.buffer) {
        cachegetUint8Memory = new Uint8Array(wasm.memory.buffer);
    }
    return cachegetUint8Memory;
}

function getStringFromWasm(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
}

function getArrayU8FromWasm(ptr, len) {
    return getUint8Memory().subarray(ptr / 1, ptr / 1 + len);
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
    return instance.ptr;
}

function passArray8ToWasm(arg) {
    const ptr = wasm.__wbindgen_malloc(arg.length * 1);
    getUint8Memory().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

const heap = new Array(32);

heap.fill(undefined);

heap.push(undefined, null, true, false);

let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function getObject(idx) { return heap[idx]; }

function dropObject(idx) {
    if (idx < 36) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}
/**
* @param {any} input
* @returns {string}
*/
module.exports.uint8array_to_hex = function(input) {
    const retptr = 8;
    const ret = wasm.uint8array_to_hex(retptr, addHeapObject(input));
    const memi32 = getInt32Memory();
    const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
    wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
    return v0;
};

/**
* Allow to differentiate between address in
* production and testing setting, so that
* one type of address is not used in another setting.
* Example
* ```javascript
* let discriminant = AddressDiscrimination.Test;
* let address = Address::single_from_public_key(public_key, discriminant);
* ```
*/
module.exports.AddressDiscrimination = Object.freeze({ Production:0,Test:1, });
/**
* This is either an single account or a multisig account depending on the witness type
*/
class Account {

    static __wrap(ptr) {
        const obj = Object.create(Account.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_account_free(ptr);
    }
    /**
    * @param {Address} address
    * @returns {Account}
    */
    static from_address(address) {
        _assertClass(address, Address);
        const ret = wasm.account_from_address(address.ptr);
        return Account.__wrap(ret);
    }
    /**
    * @param {number} discriminant
    * @returns {Address}
    */
    to_address(discriminant) {
        const ret = wasm.account_to_address(this.ptr, discriminant);
        return Address.__wrap(ret);
    }
    /**
    * @param {PublicKey} key
    * @returns {Account}
    */
    static from_public_key(key) {
        _assertClass(key, PublicKey);
        const ptr0 = key.ptr;
        key.ptr = 0;
        const ret = wasm.account_from_public_key(ptr0);
        return Account.__wrap(ret);
    }
    /**
    * @returns {AccountIdentifier}
    */
    to_identifier() {
        const ret = wasm.account_to_identifier(this.ptr);
        return AccountIdentifier.__wrap(ret);
    }
}
module.exports.Account = Account;
/**
*/
class AccountIdentifier {

    static __wrap(ptr) {
        const obj = Object.create(AccountIdentifier.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_accountidentifier_free(ptr);
    }
    /**
    * @returns {string}
    */
    to_hex() {
        const retptr = 8;
        const ret = wasm.accountidentifier_to_hex(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.AccountIdentifier = AccountIdentifier;
/**
* An address of any type, this can be one of
* * A utxo-based address without delegation (single)
* * A utxo-based address with delegation (group)
* * An address for an account
*/
class Address {

    static __wrap(ptr) {
        const obj = Object.create(Address.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_address_free(ptr);
    }
    /**
    * Construct Address from its bech32 representation
    * Example
    * ```javascript
    * const address = Address.from_string(&#39;ca1q09u0nxmnfg7af8ycuygx57p5xgzmnmgtaeer9xun7hly6mlgt3pjyknplu&#39;);
    * ```
    * @param {string} s
    * @returns {Address}
    */
    static from_string(s) {
        const ret = wasm.address_from_string(passStringToWasm(s), WASM_VECTOR_LEN);
        return Address.__wrap(ret);
    }
    /**
    * Get Address bech32 (string) representation with a given prefix
    * ```javascript
    * let public_key = PublicKey.from_bech32(
    *     &#39;ed25519_pk1kj8yvfrh5tg7n62kdcw3kw6zvtcafgckz4z9s6vc608pzt7exzys4s9gs8&#39;
    * );
    * let discriminant = AddressDiscrimination.Test;
    * let address = Address.single_from_public_key(public_key, discriminant);
    * address.to_string(&#39;ta&#39;)
    * // ta1sj6gu33yw73dr60f2ehp6xemgf30r49rzc25gkrfnrfuuyf0mycgnj78ende550w5njvwzyr20q6rypdea597uu3jnwfltljddl59cseaq7yn9
    * ```
    * @param {string} prefix
    * @returns {string}
    */
    to_string(prefix) {
        const retptr = 8;
        const ret = wasm.address_to_string(retptr, this.ptr, passStringToWasm(prefix), WASM_VECTOR_LEN);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
    /**
    * Construct a single non-account address from a public key
    * ```javascript
    * let public_key = PublicKey.from_bech32(
    *     &#39;ed25519_pk1kj8yvfrh5tg7n62kdcw3kw6zvtcafgckz4z9s6vc608pzt7exzys4s9gs8&#39;
    * );
    * let address = Address.single_from_public_key(public_key, AddressDiscrimination.Test);
    * ```
    * @param {PublicKey} key
    * @param {number} discrimination
    * @returns {Address}
    */
    static single_from_public_key(key, discrimination) {
        _assertClass(key, PublicKey);
        const ptr0 = key.ptr;
        key.ptr = 0;
        const ret = wasm.address_single_from_public_key(ptr0, discrimination);
        return Address.__wrap(ret);
    }
    /**
    * Construct a non-account address from a pair of public keys, delegating founds from the first to the second
    * @param {PublicKey} key
    * @param {PublicKey} delegation
    * @param {number} discrimination
    * @returns {Address}
    */
    static delegation_from_public_key(key, delegation, discrimination) {
        _assertClass(key, PublicKey);
        const ptr0 = key.ptr;
        key.ptr = 0;
        _assertClass(delegation, PublicKey);
        const ptr1 = delegation.ptr;
        delegation.ptr = 0;
        const ret = wasm.address_delegation_from_public_key(ptr0, ptr1, discrimination);
        return Address.__wrap(ret);
    }
    /**
    * Construct address of account type from a public key
    * @param {PublicKey} key
    * @param {number} discrimination
    * @returns {Address}
    */
    static account_from_public_key(key, discrimination) {
        _assertClass(key, PublicKey);
        const ptr0 = key.ptr;
        key.ptr = 0;
        const ret = wasm.address_account_from_public_key(ptr0, discrimination);
        return Address.__wrap(ret);
    }
}
module.exports.Address = Address;
/**
* Type for representing a Transaction with Witnesses (signatures)
*/
class AuthenticatedTransaction {

    static __wrap(ptr) {
        const obj = Object.create(AuthenticatedTransaction.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_authenticatedtransaction_free(ptr);
    }
    /**
    * Get a copy of the inner Transaction, discarding the signatures
    * @returns {Transaction}
    */
    transaction() {
        const ret = wasm.authenticatedtransaction_transaction(this.ptr);
        return Transaction.__wrap(ret);
    }
}
module.exports.AuthenticatedTransaction = AuthenticatedTransaction;
/**
* Amount of the balance in the transaction.
*/
class Balance {

    static __wrap(ptr) {
        const obj = Object.create(Balance.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_balance_free(ptr);
    }
    /**
    * @returns {any}
    */
    get_sign() {
        const ret = wasm.balance_get_sign(this.ptr);
        return takeObject(ret);
    }
    /**
    * @returns {boolean}
    */
    is_positive() {
        const ret = wasm.balance_is_positive(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_negative() {
        const ret = wasm.balance_is_negative(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_zero() {
        const ret = wasm.balance_is_zero(this.ptr);
        return ret !== 0;
    }
    /**
    * Get value without taking into account if the balance is positive or negative
    * @returns {Value}
    */
    get_value() {
        const ret = wasm.balance_get_value(this.ptr);
        return Value.__wrap(ret);
    }
}
module.exports.Balance = Balance;
/**
* `Block` is an element of the blockchain it contains multiple
* transaction and a reference to the parent block. Alongside
* with the position of that block in the chain.
*/
class Block {

    static __wrap(ptr) {
        const obj = Object.create(Block.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_block_free(ptr);
    }
    /**
    * Deserialize a block from a byte array
    * @param {any} bytes
    * @returns {Block}
    */
    static from_bytes(bytes) {
        const ret = wasm.block_from_bytes(addHeapObject(bytes));
        return Block.__wrap(ret);
    }
    /**
    * @returns {BlockId}
    */
    id() {
        const ret = wasm.block_id(this.ptr);
        return BlockId.__wrap(ret);
    }
    /**
    * @returns {BlockId}
    */
    parent_id() {
        const ret = wasm.block_parent_id(this.ptr);
        return BlockId.__wrap(ret);
    }
    /**
    *This involves copying all the fragments
    * @returns {Fragments}
    */
    fragments() {
        const ret = wasm.block_fragments(this.ptr);
        return Fragments.__wrap(ret);
    }
}
module.exports.Block = Block;
/**
*/
class BlockId {

    static __wrap(ptr) {
        const obj = Object.create(BlockId.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_blockid_free(ptr);
    }
    /**
    * @returns {Uint8Array}
    */
    as_bytes() {
        const retptr = 8;
        const ret = wasm.blockid_as_bytes(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getArrayU8FromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.BlockId = BlockId;
/**
*/
class Certificate {

    static __wrap(ptr) {
        const obj = Object.create(Certificate.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_certificate_free(ptr);
    }
    /**
    * Create a Certificate for StakeDelegation
    * @param {StakeDelegation} stake_delegation
    * @returns {Certificate}
    */
    static stake_delegation(stake_delegation) {
        _assertClass(stake_delegation, StakeDelegation);
        const ptr0 = stake_delegation.ptr;
        stake_delegation.ptr = 0;
        const ret = wasm.certificate_stake_delegation(ptr0);
        return Certificate.__wrap(ret);
    }
    /**
    * Create a Certificate for PoolRegistration
    * @param {PoolRegistration} pool_registration
    * @returns {Certificate}
    */
    static stake_pool_registration(pool_registration) {
        _assertClass(pool_registration, PoolRegistration);
        const ptr0 = pool_registration.ptr;
        pool_registration.ptr = 0;
        const ret = wasm.certificate_stake_pool_registration(ptr0);
        return Certificate.__wrap(ret);
    }
    /**
    * @param {PrivateKey} private_key
    */
    sign(private_key) {
        _assertClass(private_key, PrivateKey);
        const ptr0 = private_key.ptr;
        private_key.ptr = 0;
        wasm.certificate_sign(this.ptr, ptr0);
    }
}
module.exports.Certificate = Certificate;
/**
* Algorithm used to compute transaction fees
* Currently the only implementation if the Linear one
*/
class Fee {

    static __wrap(ptr) {
        const obj = Object.create(Fee.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_fee_free(ptr);
    }
    /**
    * Linear algorithm, this is formed by: `coefficient * (#inputs + #outputs) + constant + certificate * #certificate
    * @param {Value} constant
    * @param {Value} coefficient
    * @param {Value} certificate
    * @returns {Fee}
    */
    static linear_fee(constant, coefficient, certificate) {
        _assertClass(constant, Value);
        const ptr0 = constant.ptr;
        constant.ptr = 0;
        _assertClass(coefficient, Value);
        const ptr1 = coefficient.ptr;
        coefficient.ptr = 0;
        _assertClass(certificate, Value);
        const ptr2 = certificate.ptr;
        certificate.ptr = 0;
        const ret = wasm.fee_linear_fee(ptr0, ptr1, ptr2);
        return Fee.__wrap(ret);
    }
    /**
    * Compute the fee if possible (it can fail in case the values are out of range)
    * @param {Transaction} tx
    * @returns {Value}
    */
    calculate(tx) {
        _assertClass(tx, Transaction);
        const ptr0 = tx.ptr;
        tx.ptr = 0;
        const ret = wasm.fee_calculate(this.ptr, ptr0);
        return ret === 0 ? undefined : Value.__wrap(ret);
    }
}
module.exports.Fee = Fee;
/**
* All possible messages recordable in the Block content
*/
class Fragment {

    static __wrap(ptr) {
        const obj = Object.create(Fragment.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_fragment_free(ptr);
    }
    /**
    * @param {AuthenticatedTransaction} tx
    * @returns {Fragment}
    */
    static from_authenticated_transaction(tx) {
        _assertClass(tx, AuthenticatedTransaction);
        const ptr0 = tx.ptr;
        tx.ptr = 0;
        const ret = wasm.fragment_from_authenticated_transaction(ptr0);
        return Fragment.__wrap(ret);
    }
    /**
    * Deprecated: Use `from_authenticated_transaction` instead
    * @param {AuthenticatedTransaction} tx
    * @returns {Fragment}
    */
    static from_generated_transaction(tx) {
        _assertClass(tx, AuthenticatedTransaction);
        const ptr0 = tx.ptr;
        tx.ptr = 0;
        const ret = wasm.fragment_from_generated_transaction(ptr0);
        return Fragment.__wrap(ret);
    }
    /**
    * Get a Transaction if the Fragment represents one
    * @returns {AuthenticatedTransaction}
    */
    get_transaction() {
        const ptr = this.ptr;
        this.ptr = 0;
        const ret = wasm.fragment_get_transaction(ptr);
        return AuthenticatedTransaction.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    as_bytes() {
        const retptr = 8;
        const ret = wasm.fragment_as_bytes(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getArrayU8FromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
    /**
    * @returns {boolean}
    */
    is_initial() {
        const ret = wasm.fragment_is_initial(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_transaction() {
        const ret = wasm.fragment_is_transaction(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_owner_stake_delegation() {
        const ret = wasm.fragment_is_owner_stake_delegation(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_stake_delegation() {
        const ret = wasm.fragment_is_stake_delegation(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_pool_registration() {
        const ret = wasm.fragment_is_pool_registration(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_pool_management() {
        const ret = wasm.fragment_is_pool_management(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_old_utxo_declaration() {
        const ret = wasm.fragment_is_old_utxo_declaration(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_update_proposal() {
        const ret = wasm.fragment_is_update_proposal(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_update_vote() {
        const ret = wasm.fragment_is_update_vote(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {FragmentId}
    */
    id() {
        const ret = wasm.fragment_id(this.ptr);
        return FragmentId.__wrap(ret);
    }
}
module.exports.Fragment = Fragment;
/**
*/
class FragmentId {

    static __wrap(ptr) {
        const obj = Object.create(FragmentId.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_fragmentid_free(ptr);
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {FragmentId}
    */
    static from_bytes(bytes) {
        const ret = wasm.fragmentid_from_bytes(passArray8ToWasm(bytes), WASM_VECTOR_LEN);
        return FragmentId.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    as_bytes() {
        const retptr = 8;
        const ret = wasm.fragmentid_as_bytes(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getArrayU8FromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.FragmentId = FragmentId;
/**
*/
class Fragments {

    static __wrap(ptr) {
        const obj = Object.create(Fragments.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_fragments_free(ptr);
    }
    /**
    * @returns {number}
    */
    size() {
        const ret = wasm.fragments_size(this.ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} index
    * @returns {Fragment}
    */
    get(index) {
        const ret = wasm.fragments_get(this.ptr, index);
        return Fragment.__wrap(ret);
    }
}
module.exports.Fragments = Fragments;
/**
* Type for representing a generic Hash
*/
class Hash {

    static __wrap(ptr) {
        const obj = Object.create(Hash.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_hash_free(ptr);
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {Hash}
    */
    static from_bytes(bytes) {
        const ret = wasm.hash_from_bytes(passArray8ToWasm(bytes), WASM_VECTOR_LEN);
        return Hash.__wrap(ret);
    }
    /**
    * @param {string} hex_string
    * @returns {Hash}
    */
    static from_hex(hex_string) {
        const ret = wasm.hash_from_hex(passStringToWasm(hex_string), WASM_VECTOR_LEN);
        return Hash.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    as_bytes() {
        const retptr = 8;
        const ret = wasm.hash_as_bytes(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getArrayU8FromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.Hash = Hash;
/**
*/
class Input {

    static __wrap(ptr) {
        const obj = Object.create(Input.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_input_free(ptr);
    }
    /**
    * @param {UtxoPointer} utxo_pointer
    * @returns {Input}
    */
    static from_utxo(utxo_pointer) {
        _assertClass(utxo_pointer, UtxoPointer);
        const ret = wasm.input_from_utxo(utxo_pointer.ptr);
        return Input.__wrap(ret);
    }
    /**
    * @param {Account} account
    * @param {Value} v
    * @returns {Input}
    */
    static from_account(account, v) {
        _assertClass(account, Account);
        _assertClass(v, Value);
        const ptr0 = v.ptr;
        v.ptr = 0;
        const ret = wasm.input_from_account(account.ptr, ptr0);
        return Input.__wrap(ret);
    }
    /**
    * Get the kind of Input, this can be either \"Account\" or \"Utxo\
    * @returns {string}
    */
    get_type() {
        const retptr = 8;
        const ret = wasm.input_get_type(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
    /**
    * @returns {boolean}
    */
    is_account() {
        const ret = wasm.input_is_account(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {boolean}
    */
    is_utxo() {
        const ret = wasm.input_is_utxo(this.ptr);
        return ret !== 0;
    }
    /**
    * @returns {Value}
    */
    value() {
        const ret = wasm.input_value(this.ptr);
        return Value.__wrap(ret);
    }
    /**
    * Get the inner UtxoPointer if the Input type is Utxo
    * @returns {UtxoPointer}
    */
    get_utxo_pointer() {
        const ret = wasm.input_get_utxo_pointer(this.ptr);
        return UtxoPointer.__wrap(ret);
    }
    /**
    * Get the source Account if the Input type is Account
    * @returns {Account}
    */
    get_account() {
        const ret = wasm.input_get_account(this.ptr);
        return Account.__wrap(ret);
    }
}
module.exports.Input = Input;
/**
*/
class Inputs {

    static __wrap(ptr) {
        const obj = Object.create(Inputs.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_inputs_free(ptr);
    }
    /**
    * @returns {number}
    */
    size() {
        const ret = wasm.inputs_size(this.ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} index
    * @returns {Input}
    */
    get(index) {
        const ret = wasm.inputs_get(this.ptr, index);
        return Input.__wrap(ret);
    }
}
module.exports.Inputs = Inputs;
/**
*/
class KesPublicKey {

    static __wrap(ptr) {
        const obj = Object.create(KesPublicKey.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_kespublickey_free(ptr);
    }
    /**
    * @param {string} bech32_str
    * @returns {KesPublicKey}
    */
    static from_bech32(bech32_str) {
        const ret = wasm.kespublickey_from_bech32(passStringToWasm(bech32_str), WASM_VECTOR_LEN);
        return KesPublicKey.__wrap(ret);
    }
}
module.exports.KesPublicKey = KesPublicKey;
/**
* Type for representing a Transaction Output, composed of an Address and a Value
*/
class Output {

    static __wrap(ptr) {
        const obj = Object.create(Output.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_output_free(ptr);
    }
    /**
    * @returns {Address}
    */
    address() {
        const ret = wasm.output_address(this.ptr);
        return Address.__wrap(ret);
    }
    /**
    * @returns {Value}
    */
    value() {
        const ret = wasm.output_value(this.ptr);
        return Value.__wrap(ret);
    }
}
module.exports.Output = Output;
/**
* Helper to add change addresses when finalizing a transaction, there are currently two options
* * forget: use all the excess money as fee
* * one: send all the excess money to the given address
*/
class OutputPolicy {

    static __wrap(ptr) {
        const obj = Object.create(OutputPolicy.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_outputpolicy_free(ptr);
    }
    /**
    * don\'t do anything with the excess money in transaction
    * @returns {OutputPolicy}
    */
    static forget() {
        const ret = wasm.outputpolicy_forget();
        return OutputPolicy.__wrap(ret);
    }
    /**
    * use the given address as the only change address
    * @param {Address} address
    * @returns {OutputPolicy}
    */
    static one(address) {
        _assertClass(address, Address);
        const ptr0 = address.ptr;
        address.ptr = 0;
        const ret = wasm.outputpolicy_one(ptr0);
        return OutputPolicy.__wrap(ret);
    }
}
module.exports.OutputPolicy = OutputPolicy;
/**
*/
class Outputs {

    static __wrap(ptr) {
        const obj = Object.create(Outputs.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_outputs_free(ptr);
    }
    /**
    * @returns {number}
    */
    size() {
        const ret = wasm.outputs_size(this.ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} index
    * @returns {Output}
    */
    get(index) {
        const ret = wasm.outputs_get(this.ptr, index);
        return Output.__wrap(ret);
    }
}
module.exports.Outputs = Outputs;
/**
*/
class PoolId {

    static __wrap(ptr) {
        const obj = Object.create(PoolId.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_poolid_free(ptr);
    }
    /**
    * @param {string} hex_string
    * @returns {PoolId}
    */
    static from_hex(hex_string) {
        const ret = wasm.poolid_from_hex(passStringToWasm(hex_string), WASM_VECTOR_LEN);
        return PoolId.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    to_string() {
        const retptr = 8;
        const ret = wasm.poolid_to_string(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.PoolId = PoolId;
/**
*/
class PoolRegistration {

    static __wrap(ptr) {
        const obj = Object.create(PoolRegistration.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_poolregistration_free(ptr);
    }
    /**
    * @param {U128} serial
    * @param {PublicKeys} owners
    * @param {number} management_threshold
    * @param {TimeOffsetSeconds} start_validity
    * @param {KesPublicKey} kes_public_key
    * @param {VrfPublicKey} vrf_public_key
    * @returns {PoolRegistration}
    */
    constructor(serial, owners, management_threshold, start_validity, kes_public_key, vrf_public_key) {
        _assertClass(serial, U128);
        const ptr0 = serial.ptr;
        serial.ptr = 0;
        _assertClass(owners, PublicKeys);
        const ptr1 = owners.ptr;
        owners.ptr = 0;
        _assertClass(start_validity, TimeOffsetSeconds);
        const ptr2 = start_validity.ptr;
        start_validity.ptr = 0;
        _assertClass(kes_public_key, KesPublicKey);
        const ptr3 = kes_public_key.ptr;
        kes_public_key.ptr = 0;
        _assertClass(vrf_public_key, VrfPublicKey);
        const ptr4 = vrf_public_key.ptr;
        vrf_public_key.ptr = 0;
        const ret = wasm.poolregistration_new(ptr0, ptr1, management_threshold, ptr2, ptr3, ptr4);
        return PoolRegistration.__wrap(ret);
    }
    /**
    * @returns {PoolId}
    */
    id() {
        const ret = wasm.poolregistration_id(this.ptr);
        return PoolId.__wrap(ret);
    }
}
module.exports.PoolRegistration = PoolRegistration;
/**
* ED25519 signing key, either normal or extended
*/
class PrivateKey {

    static __wrap(ptr) {
        const obj = Object.create(PrivateKey.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_privatekey_free(ptr);
    }
    /**
    * Get private key from its bech32 representation
    * ```javascript
    * PrivateKey.from_bech32(&#39;ed25519_sk1ahfetf02qwwg4dkq7mgp4a25lx5vh9920cr5wnxmpzz9906qvm8qwvlts0&#39;);
    * ```
    * For an extended 25519 key
    * ```javascript
    * PrivateKey.from_bech32(&#39;ed25519e_sk1gqwl4szuwwh6d0yk3nsqcc6xxc3fpvjlevgwvt60df59v8zd8f8prazt8ln3lmz096ux3xvhhvm3ca9wj2yctdh3pnw0szrma07rt5gl748fp&#39;);
    * ```
    * @param {string} bech32_str
    * @returns {PrivateKey}
    */
    static from_bech32(bech32_str) {
        const ret = wasm.privatekey_from_bech32(passStringToWasm(bech32_str), WASM_VECTOR_LEN);
        return PrivateKey.__wrap(ret);
    }
    /**
    * @returns {PublicKey}
    */
    to_public() {
        const ret = wasm.privatekey_to_public(this.ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @returns {PrivateKey}
    */
    static generate_ed25519() {
        const ret = wasm.privatekey_generate_ed25519();
        return PrivateKey.__wrap(ret);
    }
    /**
    * @returns {PrivateKey}
    */
    static generate_ed25519extended() {
        const ret = wasm.privatekey_generate_ed25519extended();
        return PrivateKey.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    to_bech32() {
        const retptr = 8;
        const ret = wasm.privatekey_to_bech32(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.PrivateKey = PrivateKey;
/**
* ED25519 key used as public key
*/
class PublicKey {

    static __wrap(ptr) {
        const obj = Object.create(PublicKey.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_publickey_free(ptr);
    }
    /**
    * Get private key from its bech32 representation
    * Example:
    * ```javascript
    * const pkey = PublicKey.from_bech32(&#39;ed25519_pk1dgaagyh470y66p899txcl3r0jaeaxu6yd7z2dxyk55qcycdml8gszkxze2&#39;);
    * ```
    * @param {string} bech32_str
    * @returns {PublicKey}
    */
    static from_bech32(bech32_str) {
        const ret = wasm.publickey_from_bech32(passStringToWasm(bech32_str), WASM_VECTOR_LEN);
        return PublicKey.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    as_bytes() {
        const retptr = 8;
        const ret = wasm.publickey_as_bytes(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getArrayU8FromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.PublicKey = PublicKey;
/**
*/
class PublicKeys {

    static __wrap(ptr) {
        const obj = Object.create(PublicKeys.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_publickeys_free(ptr);
    }
    /**
    * @returns {PublicKeys}
    */
    constructor() {
        const ret = wasm.publickeys_new();
        return PublicKeys.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    size() {
        const ret = wasm.publickeys_size(this.ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} index
    * @returns {PublicKey}
    */
    get(index) {
        const ret = wasm.publickeys_get(this.ptr, index);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} key
    */
    add(key) {
        _assertClass(key, PublicKey);
        const ptr0 = key.ptr;
        key.ptr = 0;
        wasm.publickeys_add(this.ptr, ptr0);
    }
}
module.exports.PublicKeys = PublicKeys;
/**
*/
class SpendingCounter {

    static __wrap(ptr) {
        const obj = Object.create(SpendingCounter.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_spendingcounter_free(ptr);
    }
    /**
    * @returns {SpendingCounter}
    */
    static zero() {
        const ret = wasm.spendingcounter_zero();
        return SpendingCounter.__wrap(ret);
    }
    /**
    * @param {number} counter
    * @returns {SpendingCounter}
    */
    static from_u32(counter) {
        const ret = wasm.spendingcounter_from_u32(counter);
        return SpendingCounter.__wrap(ret);
    }
}
module.exports.SpendingCounter = SpendingCounter;
/**
*/
class StakeDelegation {

    static __wrap(ptr) {
        const obj = Object.create(StakeDelegation.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_stakedelegation_free(ptr);
    }
    /**
    * Create a stake delegation object from account (stake key) to pool_id
    * @param {PoolId} pool_id
    * @param {PublicKey} account
    * @returns {StakeDelegation}
    */
    static new(pool_id, account) {
        _assertClass(pool_id, PoolId);
        const ptr0 = pool_id.ptr;
        pool_id.ptr = 0;
        _assertClass(account, PublicKey);
        const ptr1 = account.ptr;
        account.ptr = 0;
        const ret = wasm.stakedelegation_new(ptr0, ptr1);
        return StakeDelegation.__wrap(ret);
    }
}
module.exports.StakeDelegation = StakeDelegation;
/**
*/
class TimeOffsetSeconds {

    static __wrap(ptr) {
        const obj = Object.create(TimeOffsetSeconds.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_timeoffsetseconds_free(ptr);
    }
    /**
    * Parse the given string into a 64 bits unsigned number
    * @param {string} number
    * @returns {TimeOffsetSeconds}
    */
    static from_string(number) {
        const ret = wasm.timeoffsetseconds_from_string(passStringToWasm(number), WASM_VECTOR_LEN);
        return TimeOffsetSeconds.__wrap(ret);
    }
}
module.exports.TimeOffsetSeconds = TimeOffsetSeconds;
/**
* Type representing a unsigned transaction
*/
class Transaction {

    static __wrap(ptr) {
        const obj = Object.create(Transaction.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_transaction_free(ptr);
    }
    /**
    * Get the transaction id, needed to compute its signature
    * @returns {TransactionSignDataHash}
    */
    id() {
        const ret = wasm.transaction_id(this.ptr);
        return TransactionSignDataHash.__wrap(ret);
    }
    /**
    * Get collection of the inputs in the transaction (this allocates new copies of all the values)
    * @returns {Inputs}
    */
    inputs() {
        const ret = wasm.transaction_inputs(this.ptr);
        return Inputs.__wrap(ret);
    }
    /**
    * Get collection of the outputs in the transaction (this allocates new copies of all the values)
    * @returns {Outputs}
    */
    outputs() {
        const ret = wasm.transaction_outputs(this.ptr);
        return Outputs.__wrap(ret);
    }
}
module.exports.Transaction = Transaction;
/**
* Builder pattern implementation for making a Transaction
*
* Example
*
* ```javascript
* const txbuilder = new TransactionBuilder();
*
* const account = Account.from_address(Address.from_string(
*   &#39;ca1qh9u0nxmnfg7af8ycuygx57p5xgzmnmgtaeer9xun7hly6mlgt3pj2xk344&#39;
* ));
*
* const input = Input.from_account(account, Value.from_str(\'1000\'));
*
* txbuilder.add_input(input);
*
* txbuilder.add_output(
*   Address.from_string(
*     &#39;ca1q5nr5pvt9e5p009strshxndrsx5etcentslp2rwj6csm8sfk24a2w3swacn&#39;
*   ),
*   Value.from_str(\'500\')
* );
*
* const feeAlgorithm = Fee.linear_fee(
*   Value.from_str(\'20\'),
*   Value.from_str(\'5\'),
*   Value.from_str(\'0\')
* );
*
* const finalizedTx = txbuilder.finalize(
*   feeAlgorithm,
*   OutputPolicy.one(accountInputAddress)
* );
* ```
*/
class TransactionBuilder {

    static __wrap(ptr) {
        const obj = Object.create(TransactionBuilder.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_transactionbuilder_free(ptr);
    }
    /**
    * Deprecated. Use `new_no_payload()` instead
    * @returns {TransactionBuilder}
    */
    constructor() {
        const ret = wasm.transactionbuilder_new();
        return TransactionBuilder.__wrap(ret);
    }
    /**
    * Create a TransactionBuilder for a transaction without certificate
    * @returns {TransactionBuilder}
    */
    static new_no_payload() {
        const ret = wasm.transactionbuilder_new_no_payload();
        return TransactionBuilder.__wrap(ret);
    }
    /**
    * Create a TransactionBuilder for a transaction with certificate
    * @param {Certificate} cert
    * @returns {TransactionBuilder}
    */
    static new_payload(cert) {
        _assertClass(cert, Certificate);
        const ptr0 = cert.ptr;
        cert.ptr = 0;
        const ret = wasm.transactionbuilder_new_payload(ptr0);
        return TransactionBuilder.__wrap(ret);
    }
    /**
    * Add input to the transaction
    * @param {Input} input
    */
    add_input(input) {
        _assertClass(input, Input);
        const ptr0 = input.ptr;
        input.ptr = 0;
        wasm.transactionbuilder_add_input(this.ptr, ptr0);
    }
    /**
    * Add output to the transaction
    * @param {Address} address
    * @param {Value} value
    */
    add_output(address, value) {
        _assertClass(address, Address);
        const ptr0 = address.ptr;
        address.ptr = 0;
        _assertClass(value, Value);
        const ptr1 = value.ptr;
        value.ptr = 0;
        wasm.transactionbuilder_add_output(this.ptr, ptr0, ptr1);
    }
    /**
    * Estimate fee with the currently added inputs, outputs and certificate based on the given algorithm
    * @param {Fee} fee
    * @returns {Value}
    */
    estimate_fee(fee) {
        _assertClass(fee, Fee);
        const ret = wasm.transactionbuilder_estimate_fee(this.ptr, fee.ptr);
        return Value.__wrap(ret);
    }
    /**
    * @param {Fee} fee
    * @returns {Balance}
    */
    get_balance(fee) {
        _assertClass(fee, Fee);
        const ret = wasm.transactionbuilder_get_balance(this.ptr, fee.ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @returns {Balance}
    */
    get_balance_without_fee() {
        const ret = wasm.transactionbuilder_get_balance_without_fee(this.ptr);
        return Balance.__wrap(ret);
    }
    /**
    * Get the Transaction with the current inputs and outputs without computing the fees nor adding a change address
    * @returns {Transaction}
    */
    unchecked_finalize() {
        const ptr = this.ptr;
        this.ptr = 0;
        const ret = wasm.transactionbuilder_unchecked_finalize(ptr);
        return Transaction.__wrap(ret);
    }
    /**
    * Finalize the transaction by adding the change Address output
    * leaving enough for paying the minimum fee computed by the given algorithm
    * see the unchecked_finalize for the non-assisted version
    *
    * Example
    *
    * ```javascript
    * const feeAlgorithm = Fee.linear_fee(
    *     Value.from_str(\'20\'), Value.from_str(\'5\'), Value.from_str(\'10\')
    * );
    *
    * const finalizedTx = txbuilder.finalize(
    *   feeAlgorithm,
    *   OutputPolicy.one(changeAddress)
    * );
    * ```
    * @param {Fee} fee
    * @param {OutputPolicy} output_policy
    * @returns {Transaction}
    */
    seal_with_output_policy(fee, output_policy) {
        const ptr = this.ptr;
        this.ptr = 0;
        _assertClass(fee, Fee);
        _assertClass(output_policy, OutputPolicy);
        const ptr0 = output_policy.ptr;
        output_policy.ptr = 0;
        const ret = wasm.transactionbuilder_seal_with_output_policy(ptr, fee.ptr, ptr0);
        return Transaction.__wrap(ret);
    }
    /**
    * Deprecated: use `seal_with_output_policy` instead
    * @param {Fee} fee
    * @param {OutputPolicy} output_policy
    * @returns {Transaction}
    */
    finalize(fee, output_policy) {
        const ptr = this.ptr;
        this.ptr = 0;
        _assertClass(fee, Fee);
        _assertClass(output_policy, OutputPolicy);
        const ptr0 = output_policy.ptr;
        output_policy.ptr = 0;
        const ret = wasm.transactionbuilder_finalize(ptr, fee.ptr, ptr0);
        return Transaction.__wrap(ret);
    }
}
module.exports.TransactionBuilder = TransactionBuilder;
/**
* Builder pattern implementation for signing a Transaction (adding witnesses)
* Example (for an account as input)
*
* ```javascript
* //finalizedTx could be the result of the finalize method on a TransactionBuilder object
* const finalizer = new TransactionFinalizer(finalizedTx);
*
* const witness = Witness.for_account(
*   Hash.from_hex(genesisHashString),
*   finalizer.get_txid(),
*   inputAccountPrivateKey,
*   SpendingCounter.zero()
* );
*
* finalizer.set_witness(0, witness);
*
* const signedTx = finalizer.build();
* ```
*/
class TransactionFinalizer {

    static __wrap(ptr) {
        const obj = Object.create(TransactionFinalizer.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_transactionfinalizer_free(ptr);
    }
    /**
    * @param {Transaction} transaction
    * @returns {TransactionFinalizer}
    */
    constructor(transaction) {
        _assertClass(transaction, Transaction);
        const ptr0 = transaction.ptr;
        transaction.ptr = 0;
        const ret = wasm.transactionfinalizer_new(ptr0);
        return TransactionFinalizer.__wrap(ret);
    }
    /**
    * Set the witness for the corresponding index, the index corresponds to the order in which the inputs were added to the transaction
    * @param {number} index
    * @param {Witness} witness
    */
    set_witness(index, witness) {
        _assertClass(witness, Witness);
        const ptr0 = witness.ptr;
        witness.ptr = 0;
        wasm.transactionfinalizer_set_witness(this.ptr, index, ptr0);
    }
    /**
    * Deprecated: Use `get_tx_sign_data_hash` instead\
    * @returns {TransactionSignDataHash}
    */
    get_txid() {
        const ret = wasm.transactionfinalizer_get_txid(this.ptr);
        return TransactionSignDataHash.__wrap(ret);
    }
    /**
    * @returns {TransactionSignDataHash}
    */
    get_tx_sign_data_hash() {
        const ret = wasm.transactionfinalizer_get_tx_sign_data_hash(this.ptr);
        return TransactionSignDataHash.__wrap(ret);
    }
    /**
    * Deprecated: Use `get_tx_sign_data_hash` instead\
    * @returns {AuthenticatedTransaction}
    */
    build() {
        const ptr = this.ptr;
        this.ptr = 0;
        const ret = wasm.transactionfinalizer_build(ptr);
        return AuthenticatedTransaction.__wrap(ret);
    }
    /**
    * @returns {AuthenticatedTransaction}
    */
    finalize() {
        const ptr = this.ptr;
        this.ptr = 0;
        const ret = wasm.transactionfinalizer_finalize(ptr);
        return AuthenticatedTransaction.__wrap(ret);
    }
}
module.exports.TransactionFinalizer = TransactionFinalizer;
/**
* Type for representing the hash of a Transaction, necessary for signing it
*/
class TransactionSignDataHash {

    static __wrap(ptr) {
        const obj = Object.create(TransactionSignDataHash.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_transactionsigndatahash_free(ptr);
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {TransactionSignDataHash}
    */
    static from_bytes(bytes) {
        const ret = wasm.transactionsigndatahash_from_bytes(passArray8ToWasm(bytes), WASM_VECTOR_LEN);
        return TransactionSignDataHash.__wrap(ret);
    }
    /**
    * @param {string} input
    * @returns {TransactionSignDataHash}
    */
    static from_hex(input) {
        const ret = wasm.transactionsigndatahash_from_hex(passStringToWasm(input), WASM_VECTOR_LEN);
        return TransactionSignDataHash.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    as_bytes() {
        const retptr = 8;
        const ret = wasm.transactionsigndatahash_as_bytes(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getArrayU8FromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.TransactionSignDataHash = TransactionSignDataHash;
/**
*/
class U128 {

    static __wrap(ptr) {
        const obj = Object.create(U128.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_u128_free(ptr);
    }
    /**
    * @param {any} bytes
    * @returns {U128}
    */
    static from_be_bytes(bytes) {
        const ret = wasm.u128_from_be_bytes(addHeapObject(bytes));
        return U128.__wrap(ret);
    }
    /**
    * @param {any} bytes
    * @returns {U128}
    */
    static from_le_bytes(bytes) {
        const ret = wasm.u128_from_le_bytes(addHeapObject(bytes));
        return U128.__wrap(ret);
    }
    /**
    * @param {string} s
    * @returns {U128}
    */
    static from_str(s) {
        const ret = wasm.u128_from_str(passStringToWasm(s), WASM_VECTOR_LEN);
        return U128.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    to_str() {
        const retptr = 8;
        const ret = wasm.u128_to_str(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.U128 = U128;
/**
* Unspent transaction pointer. This is composed of:
* * the transaction identifier where the unspent output is (a FragmentId)
* * the output index within the pointed transaction\'s outputs
* * the value we expect to read from this output, this setting is added in order to protect undesired withdrawal
* and to set the actual fee in the transaction.
*/
class UtxoPointer {

    static __wrap(ptr) {
        const obj = Object.create(UtxoPointer.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_utxopointer_free(ptr);
    }
    /**
    * @param {FragmentId} fragment_id
    * @param {number} output_index
    * @param {Value} value
    * @returns {UtxoPointer}
    */
    static new(fragment_id, output_index, value) {
        _assertClass(fragment_id, FragmentId);
        const ptr0 = fragment_id.ptr;
        fragment_id.ptr = 0;
        _assertClass(value, Value);
        const ptr1 = value.ptr;
        value.ptr = 0;
        const ret = wasm.utxopointer_new(ptr0, output_index, ptr1);
        return UtxoPointer.__wrap(ret);
    }
}
module.exports.UtxoPointer = UtxoPointer;
/**
* Type used for representing certain amount of lovelaces.
* It wraps an unsigned 64 bits number.
* Strings are used for passing to and from javascript,
* as the native javascript Number type can\'t hold the entire u64 range
* and BigInt is not yet implemented in all the browsers
*/
class Value {

    static __wrap(ptr) {
        const obj = Object.create(Value.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_value_free(ptr);
    }
    /**
    * Parse the given string into a rust u64 numeric type.
    * @param {string} s
    * @returns {Value}
    */
    static from_str(s) {
        const ret = wasm.value_from_str(passStringToWasm(s), WASM_VECTOR_LEN);
        return Value.__wrap(ret);
    }
    /**
    * Return the wrapped u64 formatted as a string.
    * @returns {string}
    */
    to_str() {
        const retptr = 8;
        const ret = wasm.value_to_str(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
    /**
    * @param {Value} other
    * @returns {Value}
    */
    checked_add(other) {
        _assertClass(other, Value);
        const ret = wasm.value_checked_add(this.ptr, other.ptr);
        return Value.__wrap(ret);
    }
    /**
    * @param {Value} other
    * @returns {Value}
    */
    checked_sub(other) {
        _assertClass(other, Value);
        const ret = wasm.value_checked_sub(this.ptr, other.ptr);
        return Value.__wrap(ret);
    }
}
module.exports.Value = Value;
/**
*/
class VrfPublicKey {

    static __wrap(ptr) {
        const obj = Object.create(VrfPublicKey.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_vrfpublickey_free(ptr);
    }
    /**
    * @param {string} bech32_str
    * @returns {VrfPublicKey}
    */
    static from_bech32(bech32_str) {
        const ret = wasm.vrfpublickey_from_bech32(passStringToWasm(bech32_str), WASM_VECTOR_LEN);
        return VrfPublicKey.__wrap(ret);
    }
}
module.exports.VrfPublicKey = VrfPublicKey;
/**
* Structure that proofs that certain user agrees with
* some data. This structure is used to sign `Transaction`
* and get `SignedTransaction` out.
*
* It\'s important that witness works with opaque structures
* and may not know the contents of the internal transaction.
*/
class Witness {

    static __wrap(ptr) {
        const obj = Object.create(Witness.prototype);
        obj.ptr = ptr;

        return obj;
    }

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_witness_free(ptr);
    }
    /**
    * Generate Witness for an utxo-based transaction Input
    * @param {Hash} genesis_hash
    * @param {TransactionSignDataHash} transaction_id
    * @param {PrivateKey} secret_key
    * @returns {Witness}
    */
    static for_utxo(genesis_hash, transaction_id, secret_key) {
        _assertClass(genesis_hash, Hash);
        const ptr0 = genesis_hash.ptr;
        genesis_hash.ptr = 0;
        _assertClass(transaction_id, TransactionSignDataHash);
        const ptr1 = transaction_id.ptr;
        transaction_id.ptr = 0;
        _assertClass(secret_key, PrivateKey);
        const ptr2 = secret_key.ptr;
        secret_key.ptr = 0;
        const ret = wasm.witness_for_utxo(ptr0, ptr1, ptr2);
        return Witness.__wrap(ret);
    }
    /**
    * Generate Witness for an account based transaction Input
    * the account-spending-counter should be incremented on each transaction from this account
    * @param {Hash} genesis_hash
    * @param {TransactionSignDataHash} transaction_id
    * @param {PrivateKey} secret_key
    * @param {SpendingCounter} account_spending_counter
    * @returns {Witness}
    */
    static for_account(genesis_hash, transaction_id, secret_key, account_spending_counter) {
        _assertClass(genesis_hash, Hash);
        const ptr0 = genesis_hash.ptr;
        genesis_hash.ptr = 0;
        _assertClass(transaction_id, TransactionSignDataHash);
        const ptr1 = transaction_id.ptr;
        transaction_id.ptr = 0;
        _assertClass(secret_key, PrivateKey);
        const ptr2 = secret_key.ptr;
        secret_key.ptr = 0;
        _assertClass(account_spending_counter, SpendingCounter);
        const ptr3 = account_spending_counter.ptr;
        account_spending_counter.ptr = 0;
        const ret = wasm.witness_for_account(ptr0, ptr1, ptr2, ptr3);
        return Witness.__wrap(ret);
    }
    /**
    * Get string representation
    * @returns {string}
    */
    to_bech32() {
        const retptr = 8;
        const ret = wasm.witness_to_bech32(retptr, this.ptr);
        const memi32 = getInt32Memory();
        const v0 = getStringFromWasm(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1]).slice();
        wasm.__wbindgen_free(memi32[retptr / 4 + 0], memi32[retptr / 4 + 1] * 1);
        return v0;
    }
}
module.exports.Witness = Witness;

module.exports.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm(arg0, arg1);
    return addHeapObject(ret);
};

module.exports.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
};

module.exports.__wbindgen_json_serialize = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = JSON.stringify(obj === undefined ? null : obj);
    const ret0 = passStringToWasm(ret);
    const ret1 = WASM_VECTOR_LEN;
    getInt32Memory()[arg0 / 4 + 0] = ret0;
    getInt32Memory()[arg0 / 4 + 1] = ret1;
};

module.exports.__wbindgen_is_undefined = function(arg0) {
    const ret = getObject(arg0) === undefined;
    return ret;
};

module.exports.__wbg_buffer_cdcb54e9871fd20a = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
};

module.exports.__wbg_length_deb426bb35063224 = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
};

module.exports.__wbg_new_8f74bcd603e235c0 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
};

module.exports.__wbg_set_662b22f1b4008ab7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
};

module.exports.__wbg_new_3a746f2619705add = function(arg0, arg1) {
    const ret = new Function(getStringFromWasm(arg0, arg1));
    return addHeapObject(ret);
};

module.exports.__wbg_call_f54d3a6dadb199ca = function(arg0, arg1) {
    const ret = getObject(arg0).call(getObject(arg1));
    return addHeapObject(ret);
};

module.exports.__wbindgen_jsval_eq = function(arg0, arg1) {
    const ret = getObject(arg0) === getObject(arg1);
    return ret;
};

module.exports.__wbg_self_ac379e780a0d8b94 = function(arg0) {
    const ret = getObject(arg0).self;
    return addHeapObject(ret);
};

module.exports.__wbg_crypto_1e4302b85d4f64a2 = function(arg0) {
    const ret = getObject(arg0).crypto;
    return addHeapObject(ret);
};

module.exports.__wbg_getRandomValues_1b4ba144162a5c9e = function(arg0) {
    const ret = getObject(arg0).getRandomValues;
    return addHeapObject(ret);
};

module.exports.__wbg_require_6461b1e9a0d7c34a = function(arg0, arg1) {
    const ret = require(getStringFromWasm(arg0, arg1));
    return addHeapObject(ret);
};

module.exports.__wbg_randomFillSync_1b52c8482374c55b = function(arg0, arg1, arg2) {
    getObject(arg0).randomFillSync(getArrayU8FromWasm(arg1, arg2));
};

module.exports.__wbg_getRandomValues_1ef11e888e5228e9 = function(arg0, arg1, arg2) {
    getObject(arg0).getRandomValues(getArrayU8FromWasm(arg1, arg2));
};

module.exports.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm(arg0, arg1));
};

module.exports.__wbindgen_rethrow = function(arg0) {
    throw takeObject(arg0);
};

module.exports.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
};
wasm = require('./js_chain_libs_bg');

