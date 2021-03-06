import { AlgorithmError, WebCryptoError, CryptoKeyError } from "../error";
import { BaseCrypto } from "../base";
import { AlgorithmNames } from "../alg";
import { Sha, ShaAlgorithms } from "../sha/crypto";

export class RsaKeyGenParamsError extends AlgorithmError {
    code = 2;
}

export class RsaHashedImportParamsError extends AlgorithmError {
    code = 6;
}

export class Rsa extends BaseCrypto {
    protected static ALG_NAME = "";
    protected static KEY_USAGES: string[] = [];

    static checkAlgorithm(alg: Algorithm) {
        if (alg.name.toUpperCase() !== this.ALG_NAME.toUpperCase())
            throw new AlgorithmError(AlgorithmError.WRONG_ALG_NAME, alg.name, this.ALG_NAME);
    }

    static checkImportAlgorithm(alg: RsaHashedImportParams) {
        /**
         * Check alg name. Use the same way as Chrome uses.
         * It throws error if algorithm doesn't have a `name` paramter
         * But it's not a equal to W3 specification
         * https://www.w3.org/TR/WebCryptoAPI/#dfn-RsaHashedImportParams
         *   
         */
        this.checkAlgorithm(alg as any);
        if (!alg.hash)
            throw new RsaHashedImportParamsError(RsaHashedImportParamsError.PARAM_REQUIRED, "hash");
        Sha.checkAlgorithm(alg.hash as Algorithm);
    }

    static checkKeyGenParams(alg: RsaHashedKeyGenParams) {
        // modulusLength
        switch (alg.modulusLength) {
            case 1024:
            case 2048:
            case 4096:
                break;
            default:
                throw new RsaKeyGenParamsError(RsaKeyGenParamsError.PARAM_WRONG_VALUE, "modulusLength", "1024, 2048 or 4096");
        }
        // publicExponent
        let pubExp = alg.publicExponent;
        if (!pubExp)
            throw new RsaKeyGenParamsError(RsaKeyGenParamsError.PARAM_REQUIRED, "publicExponent");
        if (!ArrayBuffer.isView(pubExp))
            throw new RsaKeyGenParamsError(RsaKeyGenParamsError.PARAM_WRONG_TYPE, "publicExponent", "ArrayBufferView");
        if (!(pubExp[0] === 3 || (pubExp[0] === 1 && pubExp[1] === 0 && pubExp[2] === 1)))
            throw new RsaKeyGenParamsError(RsaKeyGenParamsError.PARAM_WRONG_VALUE, "publicExponent", "Uint8Array([3]) | Uint8Array([1, 0, 1])");
        // hash
        if (!alg.hash)
            throw new RsaKeyGenParamsError(RsaKeyGenParamsError.PARAM_REQUIRED, "hash", ShaAlgorithms);
        Sha.checkAlgorithm(alg.hash as Algorithm);
    }

    static checkKeyGenUsages(keyUsages: string[]) {
        this.checkKeyUsages(keyUsages);
        keyUsages.forEach(usage => {
            let i = 0;
            for (i; i < this.KEY_USAGES.length; i++)
                if (this.KEY_USAGES[i].toLowerCase() === usage.toLowerCase()) {
                    break;
                }
            if (i === this.KEY_USAGES.length)
                throw new WebCryptoError(`Unsuported key usage '${usage}'. Should be one of [${this.KEY_USAGES.join(", ")}]`);
        });
    }

    static generateKey(algorithm: RsaHashedKeyGenParams, extractable: boolean, keyUsages: string[]): PromiseLike<CryptoKey | CryptoKeyPair> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithm(algorithm);
            this.checkKeyGenParams(algorithm);
            this.checkKeyGenUsages(keyUsages);
            resolve(undefined);
        });
    }

    static exportKey(format: string, key: CryptoKey): PromiseLike<JsonWebKey | ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.checkKey(key, this.ALG_NAME);
            this.checkFormat(format, key.type);
            resolve(undefined);
        });
    }

    static importKey(format: string, keyData: JsonWebKey | BufferSource, algorithm: string | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | DhImportKeyParams, extractable: boolean, keyUsages: string[]): PromiseLike<CryptoKey> {
        return new Promise((resolve, reject) => {
            this.checkImportAlgorithm(algorithm as RsaHashedImportParams);
            this.checkFormat(format);
            if (format.toLowerCase() === "raw")
                throw new CryptoKeyError(CryptoKeyError.ALLOWED_FORMAT, format, "'JsonWebKey', 'pkcs8' or 'spki'");
            this.checkKeyGenUsages(keyUsages);
            resolve(undefined);
        });
    }

}

export class RsaSSA extends Rsa {
    protected static ALG_NAME = AlgorithmNames.RsaSSA;
    protected static KEY_USAGES: string[] = ["sign", "verify"];

    static sign(algorithm: Algorithm, key: CryptoKey, data: Uint8Array): PromiseLike<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithmParams(algorithm);
            this.checkKey(key, this.ALG_NAME, "private", "sign");
            resolve(undefined);
        });
    }

    static verify(algorithm: Algorithm, key: CryptoKey, signature: Uint8Array, data: Uint8Array): PromiseLike<boolean> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithmParams(algorithm);
            this.checkKey(key, this.ALG_NAME, "public", "verify");
            resolve(undefined);
        });
    }
}

export class RsaPSSParamsError extends AlgorithmError {
    code = 4;
}

export class RsaPSS extends RsaSSA {
    protected static ALG_NAME = AlgorithmNames.RsaPSS;
    protected static KEY_USAGES: string[] = ["sign", "verify"];

    static checkRsaPssParams(alg: RsaPssParams) {
        /**
         * TODO: Check alg verification in browser
         */
        super.checkAlgorithmParams(alg as any);
        if (!alg.saltLength)
            return new RsaPSSParamsError(RsaPSSParamsError.PARAM_REQUIRED, "saltLength");
        if (alg.saltLength % 8)
            return new RsaPSSParamsError("Parameter 'saltLength' should be a multiple of 8");
    }
}

export class RsaOAEPParamsError extends AlgorithmError {
    code = 5;
}

export class RsaOAEP extends Rsa {
    protected static ALG_NAME = AlgorithmNames.RsaOAEP;
    protected static KEY_USAGES: string[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];

    static checkAlgorithmParams(alg: RsaOaepParams) {
        if (alg.label) {
            if (!ArrayBuffer.isView(alg.label))
                return new RsaOAEPParamsError(RsaOAEPParamsError.PARAM_WRONG_TYPE, "label", "ArrayBufferView");
        }
    }

    static encrypt(algorithm: RsaOaepParams, key: CryptoKey, data: Uint8Array): PromiseLike<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithmParams(algorithm);
            this.checkKey(key, this.ALG_NAME, "public", "encrypt");
            resolve(undefined);
        });
    }
    static decrypt(algorithm: RsaOaepParams, key: CryptoKey, data: Uint8Array): PromiseLike<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithmParams(algorithm);
            this.checkKey(key, this.ALG_NAME, "private", "decrypt");
            resolve(undefined);
        });
    }
    static wrapKey(format: string, key: CryptoKey, wrappingKey: CryptoKey, wrapAlgorithm: RsaOaepParams): PromiseLike<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithmParams(wrapAlgorithm);
            this.checkKey(wrappingKey, this.ALG_NAME, "public", "wrapKey");
            this.checkWrappedKey(key);
            this.checkFormat(format, key.type);
            resolve(undefined);
        });
    }
    static unwrapKey(format: string, wrappedKey: Uint8Array, unwrappingKey: CryptoKey, unwrapAlgorithm: RsaOaepParams, unwrappedKeyAlgorithm: Algorithm, extractable: boolean, keyUsages: string[]): PromiseLike<CryptoKey> {
        return new Promise((resolve, reject) => {
            this.checkAlgorithmParams(unwrapAlgorithm);
            this.checkKey(unwrappingKey, this.ALG_NAME, "private", "unwrapKey");
            this.checkFormat(format);
            // TODO check unwrappedKeyAlgorithm
            // TODO check keyUSages
            resolve(undefined);
        });
    }
}
