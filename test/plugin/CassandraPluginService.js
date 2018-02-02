const assert = require('assert');
const sinon = require('sinon');

const MessageBuilder = require('./dataBuilders/MessageBuilder');

const cassandraConfig = require('../../plugin/config').cassandra;
const cassandraStorage = require('../../cassandra');
const CassandraPluginService = require('../../plugin/CassandraPluginService');

describe('Plugin', () => {
    let cassandra;
    beforeEach(() => {
        cassandra = {};

        cassandra.setTableSchemas = sinon.stub().returns(cassandra);
        cassandra.setUDTSchemas = sinon.stub().returns(cassandra);
        cassandra.assignTablesToCommands = sinon.stub().returns(cassandra);
        cassandra.assignTablesToNotifications = sinon.stub().returns(cassandra);
        cassandra.assignTablesToCommandUpdates = sinon.stub().returns(cassandra);
        cassandra.insertCommand = sinon.stub().returns(cassandra);
        cassandra.insertCommandUpdate = sinon.stub().returns(cassandra);
        cassandra.insertNotification = sinon.stub().returns(cassandra);
        cassandra.checkAllSchemasExist = sinon.stub().returns(cassandra).callsFake(cb => cb(true));

        cassandraStorage.connect = sinon.stub().returns(cassandra);

        cassandraConfig.CUSTOM.SCHEMA_CHECKS_COUNT = 10;
        cassandraConfig.CUSTOM.SCHEMA_CHECKS_INTERVAL = 0;
    });

    it('Should fail application if Cassandra schemas have not been created after N checks with time intervals', done => {
        const exit = process.exit;
        process.exit = sinon.spy();
        cassandra.checkAllSchemasExist.callsFake(cb => cb(false));

        const plugin = new CassandraPluginService();
        plugin.afterStart();

        asyncAssertion(() => {
            assert.equal(cassandra.checkAllSchemasExist.callCount, 10);
            assert(process.exit.calledOnce);

            process.exit = exit;
            done();
        });
    });

    it('Should set schemas of Cassandra user defined types and tables after start', done => {
        const plugin = new CassandraPluginService();

        plugin.afterStart();

        asyncAssertion(() => {
            assert(cassandra.setTableSchemas.calledOnce);
            assert(cassandra.setUDTSchemas.calledOnce);
            done();
        });
    });

    it('Should assign tables to each group after start', done => {
        const plugin = new CassandraPluginService();

        plugin.afterStart();

        asyncAssertion(() => {
            assert(cassandra.assignTablesToCommands.calledOnce);
            assert(cassandra.assignTablesToNotifications.calledOnce);
            assert(cassandra.assignTablesToCommandUpdates.calledOnce);
            done();
        });
    });

    it('Should insert command if message is command type', done => {
        const msg = new MessageBuilder().withCommand({
            deviceId: 'test123',
            command: 'command name'
        }).build();

        const plugin = new CassandraPluginService();
        plugin.afterStart();

        asyncAssertion(() => {
            plugin.handleMessage(msg);

            assert(cassandra.insertCommand.calledOnce);
            done();
        });
    });

    it('Should insert command update if message is command type with isUpdated equals true and command updates storing is enabled', done => {
        const msg = new MessageBuilder().withCommand({
            deviceId: 'test123',
            command: 'command name',
            isUpdated: true
        }).build();

        const conf = require('../../plugin/config').cassandra;
        const commandsUpdatesStoring = conf.CUSTOM.COMMAND_UPDATES_STORING;
        conf.CUSTOM.COMMAND_UPDATES_STORING = true;

        const plugin = new CassandraPluginService();
        plugin.afterStart();

        asyncAssertion(() => {
            plugin.handleMessage(msg);

            assert(cassandra.insertCommandUpdate.calledOnce);

            conf.CUSTOM.COMMAND_UPDATES_STORING = commandsUpdatesStoring;
            done();
        });
    });

    it('Should NOT insert command update if command updates storing is disabled', done => {
        const msg = new MessageBuilder().withCommand({
            deviceId: 'test123',
            command: 'command name',
            isUpdated: true
        }).build();

        const conf = require('../../plugin/config').cassandra;
        const commandsUpdatesStoring = conf.CUSTOM.COMMAND_UPDATES_STORING;
        conf.CUSTOM.COMMAND_UPDATES_STORING = false;

        const plugin = new CassandraPluginService();
        plugin.afterStart();

        asyncAssertion(() => {
            plugin.handleMessage(msg);

            assert(cassandra.insertCommandUpdate.notCalled);

            conf.CUSTOM.COMMAND_UPDATES_STORING = commandsUpdatesStoring;
            done();
        });
    });

    it('Should insert notification if message is notification type', done => {
        const msg = new MessageBuilder().withNotification({
            deviceId: 'test123',
            notification: 'notification name'
        }).build();

        const plugin = new CassandraPluginService();
        plugin.afterStart();

        asyncAssertion(() => {
            plugin.handleMessage(msg);

            assert(cassandra.insertNotification.calledOnce);
            done();
        });
    });
});

function asyncAssertion(callback) {
    setTimeout(callback, 100);
}