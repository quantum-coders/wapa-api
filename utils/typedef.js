/**
 * @typedef {Object} WhatsAppEvent
 * @property {string} id - Unique event identifier
 * @property {number} timestamp - Event timestamp in milliseconds
 * @property {string} event - Event type
 * @property {string} session - Session identifier
 * @property {Object} metadata - Additional metadata
 * @property {Object} me - Current user information
 * @property {string} me.id - User ID in WhatsApp format
 * @property {string} me.pushName - User's display name
 * @property {Object} payload - Message payload
 * @property {string} payload.id - Message unique identifier
 * @property {number} payload.timestamp - Message timestamp in seconds
 * @property {string} payload.from - Sender ID in WhatsApp format
 * @property {boolean} payload.fromMe - Whether the message was sent by the current user
 * @property {string} payload.source - Source of the message
 * @property {string} payload.to - Recipient ID in WhatsApp format
 * @property {string} payload.body - Message text content
 * @property {boolean} payload.hasMedia - Whether the message contains media
 * @property {?Object} payload.media - Media content if present
 * @property {number} payload.ack - Acknowledgment status code
 * @property {string} payload.ackName - Acknowledgment status name
 * @property {Array} payload.vCards - Array of vCards if shared in the message
 * @property {Object} payload._data - Raw message data
 * @property {Object} payload._data.id - Message ID object
 * @property {boolean} payload._data.viewed - Whether the message has been viewed
 * @property {string} payload._data.body - Message text content
 * @property {string} payload._data.type - Message type
 * @property {number} payload._data.t - Timestamp in seconds
 * @property {string} payload._data.notifyName - Sender's display name
 * @property {string} payload._data.from - Sender ID
 * @property {string} payload._data.to - Recipient ID
 * @property {number} payload._data.ack - Acknowledgment status
 * @property {boolean} payload._data.invis - Whether the message is invisible
 * @property {boolean} payload._data.isNewMsg - Whether the message is new
 * @property {boolean} payload._data.star - Whether the message is starred
 * @property {boolean} payload._data.kicNotified - Whether KIC was notified
 * @property {boolean} payload._data.recvFresh - Whether received as fresh
 * @property {boolean} payload._data.isFromTemplate - Whether from template
 * @property {boolean} payload._data.pollInvalidated - Whether poll is invalidated
 * @property {boolean} payload._data.isSentCagPollCreation - Whether sent CAG poll creation
 * @property {?Object} payload._data.latestEditMsgKey - Latest edit message key
 * @property {?number} payload._data.latestEditSenderTimestampMs - Latest edit sender timestamp
 * @property {Array<string>} payload._data.mentionedJidList - List of mentioned JIDs
 * @property {Array} payload._data.groupMentions - Group mentions
 * @property {boolean} payload._data.isEventCanceled - Whether event is canceled
 * @property {boolean} payload._data.eventInvalidated - Whether event is invalidated
 * @property {boolean} payload._data.isVcardOverMmsDocument - Whether vCard is over MMS document
 * @property {boolean} payload._data.isForwarded - Whether message is forwarded
 * @property {boolean} payload._data.hasReaction - Whether message has reaction
 * @property {string} payload._data.viewMode - Message view mode
 * @property {Object} payload._data.messageSecret - Message secret object
 * @property {boolean} payload._data.productHeaderImageRejected - Whether product header image is rejected
 * @property {number} payload._data.lastPlaybackProgress - Last playback progress
 * @property {boolean} payload._data.isDynamicReplyButtonsMsg - Whether has dynamic reply buttons
 * @property {boolean} payload._data.isCarouselCard - Whether is carousel card
 * @property {?string} payload._data.parentMsgId - Parent message ID if reply
 * @property {?string} payload._data.callSilenceReason - Call silence reason
 * @property {boolean} payload._data.isVideoCall - Whether is video call
 * @property {?number} payload._data.callDuration - Call duration
 * @property {?Object} payload._data.callParticipants - Call participants
 * @property {boolean} payload._data.isMdHistoryMsg - Whether is MD history message
 * @property {number} payload._data.stickerSentTs - Sticker sent timestamp
 * @property {boolean} payload._data.isAvatar - Whether is avatar
 * @property {number} payload._data.lastUpdateFromServerTs - Last update from server timestamp
 * @property {?string} payload._data.invokedBotWid - Invoked bot WID
 * @property {?string} payload._data.bizBotType - Business bot type
 * @property {?string} payload._data.botResponseTargetId - Bot response target ID
 * @property {?string} payload._data.botPluginType - Bot plugin type
 * @property {?number} payload._data.botPluginReferenceIndex - Bot plugin reference index
 * @property {?string} payload._data.botPluginSearchProvider - Bot plugin search provider
 * @property {?string} payload._data.botPluginSearchUrl - Bot plugin search URL
 * @property {?string} payload._data.botPluginSearchQuery - Bot plugin search query
 * @property {boolean} payload._data.botPluginMaybeParent - Whether bot plugin maybe parent
 * @property {?string} payload._data.botReelPluginThumbnailCdnUrl - Bot reel plugin thumbnail CDN URL
 * @property {?string} payload._data.botMessageDisclaimerText - Bot message disclaimer text
 * @property {?string} payload._data.botMsgBodyType - Bot message body type
 * @property {Object} payload._data.reportingTokenInfo - Reporting token info
 * @property {?boolean} payload._data.requiresDirectConnection - Whether requires direct connection
 * @property {?string} payload._data.bizContentPlaceholderType - Business content placeholder type
 * @property {boolean} payload._data.hostedBizEncStateMismatch - Whether hosted biz enc state mismatch
 * @property {boolean} payload._data.senderOrRecipientAccountTypeHosted - Whether sender or recipient account type hosted
 * @property {boolean} payload._data.placeholderCreatedWhenAccountIsHosted - Whether placeholder created when account is hosted
 * @property {Array} payload._data.links - Links in message
 */