const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { books } = event

  if (!books || !Array.isArray(books) || books.length === 0) {
    return { success: false, code: 'INVALID_DATA', message: 'No books to migrate' }
  }

  const idMapping = {}
  const results = []

  try {
    for (const book of books) {
      // Check if already migrated (by local_id field)
      const existing = await db.collection('books')
        .where({ local_id: book.id, creator_id: OPENID })
        .limit(1)
        .get()

      if (existing.data.length > 0) {
        // Already migrated — just record mapping
        idMapping[book.id] = existing.data[0]._id
        results.push({ localId: book.id, status: 'skipped' })
        continue
      }

      // 1. Create book document
      const bookDoc = {
        name: book.name,
        cover_color: book.cover_color || '#34C759',
        currency: book.currency || 'CNY',
        currency_symbol: book.currency_symbol || '¥',
        start_date: book.start_date || '',
        end_date: book.end_date || null,
        status: 'active',
        creator_id: OPENID,
        member_count: (book.members || []).length,
        created_at: book.created_at || Date.now(),
        updated_at: Date.now(),
        local_id: book.id,
        version: 1
      }
      const bookRes = await db.collection('books').add({ data: bookDoc })
      const cloudBookId = bookRes._id
      idMapping[book.id] = cloudBookId

      // 2. Create member documents
      const memberIdMapping = {}
      if (book.members && book.members.length > 0) {
        for (const member of book.members) {
          const memberDoc = {
            book_id: cloudBookId,
            type: member.type || 'real',
            user_id: member.type === 'real' ? OPENID : (member.user_id || ''),
            nickname: member.nickname || '',
            avatar_url: member.avatar_url || '',
            shadow_name: member.shadow_name || '',
            is_claimed: member.is_claimed || false,
            claimed_by: member.claimed_by || null,
            claimed_at: member.claimed_at || null,
            role: member.role || (member.type === 'real' ? 'admin' : 'member'),
            joined_at: member.joined_at || Date.now(),
            local_id: member.id
          }
          const memRes = await db.collection('members').add({ data: memberDoc })
          memberIdMapping[member.id] = memRes._id
        }
      }

      // 3. Create bill documents (if bills passed inline)
      if (book._bills && Array.isArray(book._bills)) {
        for (const bill of book._bills) {
          const mappedSplits = (bill.splits || []).map(s => ({
            member_id: memberIdMapping[s.member_id] || s.member_id,
            name: s.name,
            share: s.share,
            is_shadow: s.is_shadow
          }))

          const billDoc = {
            book_id: cloudBookId,
            local_id: bill.id,
            amount: bill.amount || 0,
            category: bill.category || 'other',
            category_name: bill.category_name || '其他',
            note: bill.note || '',
            images: bill.images || [],
            location: bill.location || '',
            payer_id: memberIdMapping[bill.payer_id] || bill.payer_id,
            payer_name: bill.payer_name || '',
            splits: mappedSplits,
            split_type: bill.split_type || 'equal',
            source: bill.source || 'manual',
            paid_at: bill.paid_at || '',
            created_by: OPENID,
            created_at: bill.local_created ? new Date(bill.local_created).getTime() : Date.now(),
            updated_at: Date.now(),
            version: 1
          }
          await db.collection('bills').add({ data: billDoc })
        }
      }

      results.push({ localId: book.id, cloudId: cloudBookId, status: 'created' })
    }

    return {
      success: true,
      data: { idMapping, results, migratedCount: results.filter(r => r.status === 'created').length }
    }
  } catch (err) {
    console.error('migrateLocal error:', err)
    return { success: false, code: 'MIGRATION_ERROR', message: err.message, partialResults: results }
  }
}
