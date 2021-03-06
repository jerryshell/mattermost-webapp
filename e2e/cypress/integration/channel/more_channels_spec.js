// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Channels', () => {
    let testUser;
    let otherUser;
    let testTeam;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });

            cy.apiLogin(testUser).then(() => {
                // # Create new test channel
                cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
                    testChannel = channel;
                });

                // # Go to town square
                cy.visit(`/${team.name}/channels/town-square`);
            });
        });
    });

    it('MM-19337 Verify UI of More channels modal with archived selection', () => {
        verifyMoreChannelsModalWithArchivedSelection(false, testUser, testTeam);
        verifyMoreChannelsModalWithArchivedSelection(true, testUser, testTeam);
    });

    it('MM-19337 Enable users to view archived channels', () => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as new user and go to "/"
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Go to LHS and click "More..." under Public Channels group
        cy.get('#publicChannelList').should('be.visible').within(() => {
            cy.findByText('More...').scrollIntoView().should('be.visible').click();
        });

        cy.get('#moreChannelsModal').should('be.visible').within(() => {
            // * Dropdown should be visible, defaulting to "Public Channels"
            cy.get('#channelsMoreDropdown').should('be.visible').and('contain', 'Show: Public Channels').wait(TIMEOUTS.HALF_SEC);

            cy.get('#searchChannelsTextbox').should('be.visible').type(testChannel.display_name).wait(TIMEOUTS.HALF_SEC);
            cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 1).within(() => {
                cy.findByText(testChannel.display_name).should('be.visible');
            });
            cy.get('#searchChannelsTextbox').clear();

            // * Channel test should be visible as a public channel in the list
            cy.get('#moreChannelsList').should('be.visible').within(() => {
                // # Click to join the channel
                cy.findByText(testChannel.display_name).scrollIntoView().should('be.visible').click();
            });
        });

        // # Verify that the modal is closed and it's redirected to the selected channel
        cy.get('#moreChannelsModal').should('not.exist');
        cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

        // # Login as channel admin and go directly to the channel
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Click channel header to open channel menu
        cy.get('#channelHeaderTitle').should('contain', testChannel.display_name).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Archive the channel
            cy.findByText('Archive Channel').should('be.visible').click();
        });

        // * Verify that the delete/archive channel modal is opened
        cy.get('#deleteChannelModal').should('be.visible').within(() => {
            // # Confirm archive
            cy.findByText('Archive').should('be.visible').click();
        });

        // # Go to LHS and click "More..." under Public Channels group
        cy.get('#publicChannelList').should('be.visible').within(() => {
            cy.findByText('More...').scrollIntoView().should('be.visible').click();
        });

        cy.get('#moreChannelsModal').should('be.visible').within(() => {
            // # CLick dropdown to open selection
            cy.get('#channelsMoreDropdown').should('be.visible').click().within((el) => {
                // # Click on archived channels item
                cy.findByText('Archived Channels').should('be.visible').click();

                // * Channel test should be visible as an archived channel in the list
                cy.wrap(el).should('contain', 'Show: Archived Channels');
            });

            cy.get('#searchChannelsTextbox').should('be.visible').type(testChannel.display_name).wait(TIMEOUTS.HALF_SEC);
            cy.get('#moreChannelsList').children().should('have.length', 1).within(() => {
                cy.findByText(testChannel.display_name).should('be.visible');
            });
            cy.get('#searchChannelsTextbox').clear();

            // * Test channel should be visible as a archived channel in the list
            cy.get('#moreChannelsList').should('be.visible').within(() => {
                // # Click to view archived channel
                cy.findByText(testChannel.display_name).scrollIntoView().should('be.visible').click();
            });
        });

        // * Assert that channel is archived and new messages can't be posted.
        cy.get('#channelArchivedMessage').should('contain', 'You are viewing an archived channel. New messages cannot be posted.');
        cy.get('#post_textbox').should('not.exist');

        // # Switch to another channel
        cy.get('#sidebarItem_town-square').click();

        // * Assert that archived channel doesn't show up in LHS list
        cy.get('#publicChannelList').should('not.contain', testChannel.display_name);
    });
});

function verifyMoreChannelsModalWithArchivedSelection(isEnabled, testUser, testTeam) {
    // # Login as sysadmin and Update config to enable/disable viewing of archived channels
    cy.apiAdminLogin();
    cy.apiUpdateConfig({
        TeamSettings: {
            ExperimentalViewArchivedChannels: isEnabled,
        },
    });

    // * Verify more channels modal
    cy.visit(`/${testTeam.name}/channels/town-square`);
    verifyMoreChannelsModal(isEnabled);

    // # Login as regular user and verify more channels modal
    cy.apiLogin(testUser);
    cy.visit(`/${testTeam.name}/channels/town-square`);
    verifyMoreChannelsModal(isEnabled);
}

function verifyMoreChannelsModal(isEnabled) {
    // # Select "More..." on the left hand side menu
    cy.get('#publicChannelList').should('be.visible').within(() => {
        cy.findByText('More...').scrollIntoView().should('be.visible').click({force: true});
    });

    // * Verify that the more channels modal is open and with or without option to view archived channels
    cy.get('#moreChannelsModal').should('be.visible').within(() => {
        if (isEnabled) {
            cy.get('#channelsMoreDropdown').should('be.visible').and('have.text', 'Show: Public Channels');
        } else {
            cy.get('#channelsMoreDropdown').should('not.exist');
        }
    });
}
