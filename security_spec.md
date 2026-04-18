# Firestore Security Spec

## Data Invariants
1. Channels must have an owner.
2. Only Admins can create new Channels.
3. Only the owner or an Admin can update/delete a Channel.
4. Anyone can view (read/list) a Channel and its videos (if it's public, but here we assume all channels are viewable if you have the link).
5. Only channel owners or editors can manage videos within a channel.
6. Users cannot self-promote to 'admin'.
7. Video IDs and Channel IDs must be valid.

## The Dirty Dozen (Potential Vulnerabilities to Block)
1. **Identity Spoofing**: User A attempts to create a channel as User B by setting `ownerId` to B's UID.
2. **Privilege Escalation**: User A attempts to set their own role to 'admin' in `app_users`.
3. **Orphaned Writes**: Creating a video for a channel that doesn't exist.
4. **Unauthorized Deletion**: User B attempts to delete User A's channel.
5. **Schema Poisoning**: Sending a 1MB string in the `title` field.
6. **ID Poisoning**: Injecting strange characters into the `channelId` path.
7. **State Bypass**: Overwriting `createdAt` timestamp.
8. **Malicious Role Update**: An editor trying to update another user's role.
9. **Spam Attacks**: Creating thousands of channels (rate limiting/size checks).
10. **Shadow Updates**: Including hidden fields like `isVerified: true` in a video update.
11. **Client-Side Query Bypass**: Reading all `app_users` without a specific filter.
12. **PII Leak**: Unauthorized access to another user's email address in `app_users`.

## Verification Plan
1. Helper functions for each entity.
2. `affectedKeys().hasOnly()` gates for updates.
3. `exists()` check for relational integrity.
4. `request.auth.token.email_verified == true` for writes.
