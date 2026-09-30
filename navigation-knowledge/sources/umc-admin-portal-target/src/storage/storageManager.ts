/**
 * Storage Manager Type Definition
 */
type StorageType = 'local' | 'session'
type ExpiryTime = number | Date
interface StorageData<T> {
    value: T
    expires?: number 
    timestamp: number 
}

/**
 * storage manager
 * Provide unified management of local storage and session storage
 */
class StorageManager {
    /**
     * Set storage items
     * @param key - 
     * @param value - 
     * @param options - 
     */
    static set<T>(
        key: string, 
        value: T, 
        options: {
            type?: StorageType
            expires?: ExpiryTime
        } = {}
    ): void {
        const { type = 'local', expires } = options
        const storage = type === 'local' ? localStorage : sessionStorage

        const data: StorageData<T> = {
            value,
            timestamp: Date.now()
        }

        // Set expiration time
        if (expires) {
            data.expires = expires instanceof Date 
                ? expires.getTime()
                : Date.now() + expires
        }

        storage.setItem(key, JSON.stringify(data))
    }

    /**
     * Retrieve storage items
     * @param key - 
     * @param defaultValue - 
     * @param options - 
     */
    static get<T>(
        key: string, 
        defaultValue: T, 
        options: {
            type?: StorageType
            removeIfExpired?: boolean
        } = {}
    ): T {
        const { type = 'local', removeIfExpired = true } = options
        const storage = type === 'local' ? localStorage : sessionStorage

        const item = storage.getItem(key)
        if (!item) return defaultValue

        try {
            const data = JSON.parse(item) as StorageData<T>

            // Check if it has expired
            if (data.expires && Date.now() > data.expires) {
                if (removeIfExpired) {
                    this.remove(key, { type })
                }
                return defaultValue
            }

            return data.value
        } catch {
            
            return item as unknown as T
        }
    }

    /**
     * Remove storage item
     * @param key - 
     * @param options - 
     */
    static remove(
        key: string | string[], 
        options: { type?: StorageType } = {}
    ): void {
        const { type = 'local' } = options
        const storage = type === 'local' ? localStorage : sessionStorage

        if (Array.isArray(key)) {
            key.forEach(k => storage.removeItem(k))
        } else {
            storage.removeItem(key)
        }
    }

    /**
     * Clear storage
     * @param type - 
     */
    static clear(type: StorageType = 'local'): void {
        const storage = type === 'local' ? localStorage : sessionStorage
        storage.clear()
    }

    /**
     * Retrieve all storage keys
     * @param type - 
     */
    static keys(type: StorageType = 'local'): string[] {
        const storage = type === 'local' ? localStorage : sessionStorage
        return Object.keys(storage)
    }

    /**
     * Retrieve the number of storage items
     * @param type - 
     */
    static size(type: StorageType = 'local'): number {
        const storage = type === 'local' ? localStorage : sessionStorage
        return storage.length
    }

    /**
     * Check if the storage item exists
     * @param key - 
     * @param options - 
     */
    static has(
        key: string, 
        options: {
            type?: StorageType
            checkExpiry?: boolean
        } = {}
    ): boolean {
        const { type = 'local', checkExpiry = true } = options
        const storage = type === 'local' ? localStorage : sessionStorage

        const item = storage.getItem(key)
        if (!item) return false

        if (!checkExpiry) return true

        try {
            const data = JSON.parse(item) as StorageData<unknown>
            return !data.expires || Date.now() <= data.expires
        } catch {
            return true
        }
    }

    /**
     * Retrieve the remaining validity period of the storage item (in milliseconds)
     * @param key - 
     * @param options - 
     */
    static getTimeToLive(
        key: string, 
        options: { type?: StorageType } = {}
    ): number | null {
        const { type = 'local' } = options
        const storage = type === 'local' ? localStorage : sessionStorage

        const item = storage.getItem(key)
        if (!item) return null

        try {
            const data = JSON.parse(item) as StorageData<unknown>
            if (!data.expires) return null

            const ttl = data.expires - Date.now()
            return ttl > 0 ? ttl : 0
        } catch {
            return null
        }
    }

    /**
     * Update the expiration time of storage items
     * @param key - 
     * @param expires - 
     * @param options - 
     */
    static updateExpiry(
        key: string, 
        expires: ExpiryTime, 
        options: { type?: StorageType } = {}
    ): boolean {
        const { type = 'local' } = options
        const storage = type === 'local' ? localStorage : sessionStorage

        const item = storage.getItem(key)
        if (!item) return false

        try {
            const data = JSON.parse(item) as StorageData<unknown>
            data.expires = expires instanceof Date 
                ? expires.getTime() 
                : Date.now() + expires
            storage.setItem(key, JSON.stringify(data))
            return true
        } catch {
            return false
        }
    }
}

export default StorageManager