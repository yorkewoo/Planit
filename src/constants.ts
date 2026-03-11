import { createClient } from '@supabase/supabase-js'
import { Project, Staff, Task } from './types';

// 1. 初始化 Supabase 客户端
// 注意：这里我们使用 VITE_ 前缀，确保 Vite 能读取到 .env 里的变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing! Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. 导出类型（保留你原来的类型定义）
export type { Project, Staff, Task };