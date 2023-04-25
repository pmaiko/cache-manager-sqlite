const assert = require('assert')
const cacheManager = require('cache-manager')
const sinon = require('sinon')
const sqlite3 = require('sqlite3')

const sqliteStore = require('../index')

describe('cacheManager open callback', () => {
    it('should be able to open via options', (done) => {
        cacheManager.caching({
            store: sqliteStore,
            name: 'fool',
            path: '/tmp/cache.db',
            options: {
                onReady: done
            }
        })
    })

    it('should be able to use default options', (done) => {
        cacheManager.caching({
            store: sqliteStore,
            options: {
                onReady: done
            }
        })
    })
})

describe('cacheManager callback', () => {
    const cache = cacheManager.caching({
        store: sqliteStore
    })

    it('get should return null when value does not exist', (done) => {
        cache.get('!!!' + Math.random(), (err, res) => {
            assert.equal(res, null)
            done(err)
        })
        
    })
    
    it('set should serialize objects', (done) => {
        cache.set('foo', {foo: 1}, (err) => {
            done(err)
        })
    })

    it('mset sets multiple values in single call', (done) => {
        cache.mset('goo1', 1, 'goo2', 2, 'goo3', 3, (err) => {
            done(err)
        })
    })
})

describe('cacheManager promised', () => {
    const cache = cacheManager.caching({
        store: sqliteStore
    })

    it('set should serialized bad object to null', async () => {
        await cache.set('foo-bad', function () { })
        assert.equal(await cache.get('foo-bad'), null)
    })

    it('get value when TTL within range from set', async () => {
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu, {ttl: -200})
        const val = await cache.get(key)
        assert.equal(val, null)
    })

    it('should read saved value', async () => {
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu)
        const val = await cache.get(key)
        assert.deepEqual(val, valu)
    })

    it('does not error on del non-existent key', async () => {
        const key = 'foo' + new Date().getTime()

        await cache.del(key)
    })

    it('removes existing key with del', async () => {
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu)
        await cache.del(key)
        const v = await cache.get(key)
        assert.equal(v, null)
    })

    it('truncates database on reset', async () => {
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu)
        await cache.reset()
        const v = await cache.get(key)
        assert.equal(v, null)
    })

    it('returns ttl of key', async () => {
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu)
        const v = await cache.ttl(key)
        assert(v > 0)
    })

    it('returns ttl a negative value for non-existent keys', async () => {
        const key = 'foo' + new Date().getTime()
        const v = await cache.ttl(key)
        assert(v < 0)
    })

    it('works with various combinations of passing ttl to set', async () => {
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu, -1)
        assert.equal(await cache.get(key), null)

        await cache.set(key, valu, {ttl: -1})
        assert.equal(await cache.get(key), null)
    })

    it('mget fetches array of multiple objects ', async () => {
        await cache.set('foo1', 1)
        await cache.set('foo2', 2)
        await cache.set('foo3', 3)
        const rs = await cache.mget(['foo1', 'foo2', 'foo3'])
        assert.deepEqual(rs, [1, 2, 3])
    })

    it('mset sets multiple values in single call', async () => {
        await cache.mset('goo1', 1, 'goo2', 2, 'goo3', 3)
        const rs = await cache.mget(['goo1', 'goo2', 'goo3'])
        assert.deepEqual(rs, [1, 2, 3])
    })

    it('mset respects ttl if passed', async () => {
        await cache.mset('goo1', 1, 'goo2', 2, 'goo3', 3, {ttl: -1})
        const rs = await cache.mget(['goo1', 'goo2', 'goo3'])
        assert.deepEqual(rs, [])
    })
})

describe('Sqlite failures failures', () => {
    const cache = cacheManager.caching({
        store: sqliteStore
    })

    let allSpy

    beforeEach(() => {
        allSpy = sinon.stub(sqlite3.Database.prototype, "all")
        allSpy.reset()
    })

    afterEach(() => {
        allSpy.restore()
    })

    it('should fail get if sqlite errors out', async () => {
        allSpy.yieldsRight(new Error('Fake error'))
        try {
            await cache.get("foo")
        } catch (e) {
            assert.equal(e.message, 'Fake error')
        }
    })

    it('should fail ttl if sqlite errors out', async () => {
        allSpy.yieldsRight(new Error('Fake error'))
        try {
            await cache.ttl("foo")
        } catch (e) {
            assert.equal(e.message, 'Fake error')
        }
    })

    it('should return null value if stored value is junk', async () => {
        const ts = new Date().getTime()
        allSpy.yieldsRight(null, [{key: 'foo', val: '~junk~', created_at: ts, expire_at: ts + 36000}])
        assert.equal(await cache.get("foo"), null)

        allSpy.reset()
        allSpy.yieldsRight(null, [{key: 'foo', val: 'undefined', created_at: ts, expire_at: ts + 36000}])
        assert.equal(await cache.get("foo"), null)
    })
})


describe('sqliteStore construction', () => {
    it('should apply default ttl of store when not passed in set', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: {
                ttl: -1
            }
        })
        
        const key = 'foo' + new Date().getTime()
        const valu = {foo: 1}

        await cache.set(key, valu)
        assert.equal(await cache.get(key), null)
    })
})