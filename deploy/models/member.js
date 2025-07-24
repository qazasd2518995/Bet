import db from '../config.js';

class MemberModel {
    static async findByUsername(username) {
        try {
            const member = await db.oneOrNone(
                'SELECT * FROM members WHERE username = $1',
                [username]
            );
            return member;
        } catch (error) {
            console.error('查詢會員失敗:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const member = await db.oneOrNone(
                'SELECT * FROM members WHERE id = $1',
                [id]
            );
            return member;
        } catch (error) {
            console.error('根據ID查詢會員失敗:', error);
            throw error;
        }
    }

    static async create(memberData) {
        try {
            const { username, password, agent_id, balance = 0, status = 1 } = memberData;
            
            const member = await db.one(
                'INSERT INTO members (username, password, agent_id, balance, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
                [username, password, agent_id, balance, status]
            );
            
            return member;
        } catch (error) {
            console.error('創建會員失敗:', error);
            throw error;
        }
    }

    static async updateBalance(id, newBalance) {
        try {
            const result = await db.result(
                'UPDATE members SET balance = $1, updated_at = NOW() WHERE id = $2',
                [newBalance, id]
            );
            return result.rowCount > 0;
        } catch (error) {
            console.error('更新會員餘額失敗:', error);
            throw error;
        }
    }

    static async updateStatus(id, status) {
        try {
            const result = await db.result(
                'UPDATE members SET status = $1, updated_at = NOW() WHERE id = $2',
                [status, id]
            );
            return result.rowCount > 0;
        } catch (error) {
            console.error('更新會員狀態失敗:', error);
            throw error;
        }
    }

    static async findByAgentId(agentId, limit = 20, offset = 0) {
        try {
            const members = await db.any(
                'SELECT * FROM members WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
                [agentId, limit, offset]
            );
            return members;
        } catch (error) {
            console.error('根據代理ID查詢會員失敗:', error);
            throw error;
        }
    }

    static async count(agentId = null) {
        try {
            let query = 'SELECT COUNT(*) as count FROM members';
            let params = [];
            
            if (agentId) {
                query += ' WHERE agent_id = $1';
                params.push(agentId);
            }
            
            const result = await db.one(query, params);
            return parseInt(result.count);
        } catch (error) {
            console.error('統計會員數量失敗:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            const result = await db.result(
                'DELETE FROM members WHERE id = $1',
                [id]
            );
            return result.rowCount > 0;
        } catch (error) {
            console.error('刪除會員失敗:', error);
            throw error;
        }
    }
}

export default MemberModel; 