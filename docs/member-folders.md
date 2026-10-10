# Member folders

Members have an optional `status`: `active`, `hidden`, or `ended`. Legacy documents without the field remain active. The default directory and sidebar show active members only. Hidden and contract-ended members appear in separate folders, with an all-members view and per-folder counts/search. Returning from a record keeps the selected folder for the current workspace session.

Card and sidebar menus move members; archived cards offer restore. Open archived records retain their session and show a restore action. Updates change only status and updatedAt, preserve creation order/profile/records/files, and sync through the existing member listener across devices. Status changes require the authenticated owner and an online, server-synced list. Pending writes disable duplicate actions; failures surface an error and successful changes show a temporary toast. This is organization only, not deletion or a contractual/billing operation.

Firestore validates status enum values and retains ownership, timestamp, counter and deletion constraints. No new index, AI calls or extra subscription is required. An archive does not reduce stored data usage.

Validation: 133 Firestore/Storage and pure filtering tests passed, including legacy visibility, owner-only changes, persistence across sessions, record/profile preservation, restoration, and existing file/record constraints. Browser checks with synthetic local members covered active to hidden to ended to active, counts, menus and empty states. The temporary preview route was removed before production build.
