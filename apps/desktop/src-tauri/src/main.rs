// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod search;
mod memory;
mod ratings;
mod ai;
mod knowledge_graph;
mod profile;
mod privacy;
mod theme;
mod tabs;
mod bookmarks;
mod split_view;
mod multimedia;
mod webview;
mod scraper;

use std::sync::Mutex;
use tauri::{Manager, State};

use profile::{Profile, ProfileManager, PrivacySettings};
use privacy::{PrivacyManager, HistoryEntry, HistoryStats};
use knowledge_graph::{KnowledgeGraph, Page, SearchResult as KGSearchResult};
use theme::{Theme, ThemeManager, PresetTheme, get_preset_themes};
use search::{Domain, DomainList, DomainStats, SearchManager};
use memory::{IndexedPage, PageNote, MemoryStats, MemoryManager};
use ratings::{DomainRating, RatingAggregate, RatingSummary, SubdomainRating, RatingManager, UserRatingHistory};
use tabs::{Tab, TabHistoryEntry, TabManager};
use bookmarks::{Bookmark, BookmarkFolder, BookmarkManager};
use split_view::{SplitViewConfig, SplitViewManager, PaneSizes};
use multimedia::{MediaHistoryEntry, Playlist, PlaylistItem, PrivacySettings as MediaPrivacySettings, MediaStats, MultimediaManager};
use scraper::{ScrapingJob, ScrapedPage, ContentSelector, ScraperManager};

// Application state managed by Tauri
struct AppState {
    db_path: String,
    profile_manager: ProfileManager,
    privacy_manager: PrivacyManager,
    knowledge_graph: KnowledgeGraph,
    theme_manager: ThemeManager,
    search_manager: SearchManager,
    memory_manager: MemoryManager,
    rating_manager: RatingManager,
    tab_manager: TabManager,
    bookmark_manager: BookmarkManager,
    split_view_manager: SplitViewManager,
    multimedia_manager: MultimediaManager,
    scraper_manager: ScraperManager,
}

// ==================== Profile Commands ====================

#[tauri::command]
async fn get_profiles(state: State<'_, Mutex<AppState>>) -> Result<Vec<Profile>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .get_profiles()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_active_profile(state: State<'_, Mutex<AppState>>) -> Result<Option<Profile>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .get_active_profile()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_profile(
    state: State<'_, Mutex<AppState>>,
    name: String,
    icon: Option<String>,
) -> Result<Profile, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .create_profile(&name, icon.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn switch_profile(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Profile, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .switch_profile(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_profile(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    name: String,
    icon: Option<String>,
) -> Result<Profile, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .update_profile(profile_id, &name, icon.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_profile(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .delete_profile(profile_id)
        .map_err(|e| format!("Cannot delete profile: {}", e))
}

#[tauri::command]
async fn get_privacy_settings(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<PrivacySettings, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .get_privacy_settings(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_privacy_settings(
    state: State<'_, Mutex<AppState>>,
    settings: PrivacySettings,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .update_privacy_settings(&settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_profile(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.profile_manager
        .export_profile(profile_id)
        .map_err(|e| e.to_string())
}

// ==================== Incognito Commands ====================

#[tauri::command]
fn get_incognito_status() -> bool {
    PrivacyManager::is_incognito()
}

#[tauri::command]
fn toggle_incognito() -> bool {
    PrivacyManager::toggle_incognito()
}

#[tauri::command]
fn set_incognito(enabled: bool) {
    if enabled {
        PrivacyManager::enable_incognito();
    } else {
        PrivacyManager::disable_incognito();
    }
}

// ==================== History Commands ====================

#[tauri::command]
async fn get_history(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    search_query: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<HistoryEntry>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.privacy_manager
        .get_history(
            profile_id,
            search_query.as_deref(),
            limit.unwrap_or(50),
            offset.unwrap_or(0),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_history_entry(
    state: State<'_, Mutex<AppState>>,
    entry_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.privacy_manager
        .delete_history_entry(entry_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_history_by_date_range(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    start_date: String,
    end_date: String,
) -> Result<i64, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.privacy_manager
        .delete_history_by_date_range(profile_id, &start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_all_history(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<i64, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.privacy_manager
        .clear_all_history(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_history_stats(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<HistoryStats, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.privacy_manager
        .get_history_stats(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_history(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.privacy_manager
        .export_history(profile_id)
        .map_err(|e| e.to_string())
}

// ==================== Knowledge Graph Commands ====================

#[tauri::command]
async fn add_page(
    state: State<'_, Mutex<AppState>>,
    url: String,
    title: String,
    content: String,
    profile_id: i64,
) -> Result<Option<i64>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let page = Page {
        id: None,
        url,
        title,
        content,
        visited_at: String::new(),
        embedding: None,
        profile_id: Some(profile_id),
    };
    state.knowledge_graph
        .add_page(&page, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_knowledge_graph(
    state: State<'_, Mutex<AppState>>,
    query: String,
    profile_id: i64,
    limit: Option<i64>,
) -> Result<Vec<KGSearchResult>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.knowledge_graph
        .search_pages(&query, profile_id, limit.unwrap_or(20))
        .map_err(|e| e.to_string())
}

// ==================== Domain Commands (EarthSearch) ====================

#[tauri::command]
async fn get_domains(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<Domain>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .get_domains(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_domain_entry(
    state: State<'_, Mutex<AppState>>,
    url: String,
    category: String,
    trust_score: f64,
    profile_id: i64,
) -> Result<Domain, String> {
    let domain = Domain {
        id: None,
        url,
        category,
        trust_score,
        added_date: String::new(),
        metadata: None,
        profile_id: Some(profile_id),
    };
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .add_domain(&domain, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_domain(
    state: State<'_, Mutex<AppState>>,
    domain: Domain,
) -> Result<Domain, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .update_domain(&domain)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_domain_entry(
    state: State<'_, Mutex<AppState>>,
    domain_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .delete_domain(domain_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_domain_list(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    query: String,
) -> Result<Vec<Domain>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .search_domains(profile_id, &query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_domain_lists(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<DomainList>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .get_lists(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_domain_list(
    state: State<'_, Mutex<AppState>>,
    name: String,
    description: Option<String>,
    profile_id: i64,
) -> Result<DomainList, String> {
    let list = DomainList {
        id: None,
        name,
        description,
        author: None,
        version: "1.0".to_string(),
        created_at: String::new(),
        profile_id: Some(profile_id),
        domain_count: None,
    };
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .create_list(&list, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_domain_list(
    state: State<'_, Mutex<AppState>>,
    list_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .delete_list(list_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_domain_stats(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<DomainStats, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .get_stats(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_domain_categories(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<String>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .get_categories(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_domains(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .export_domains(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_domains(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    json_data: String,
) -> Result<i64, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .import_domains(profile_id, &json_data)
        .map_err(|e| e.to_string())
}

// ==================== Memory Commands (EarthMemory) ====================

#[tauri::command]
async fn get_indexed_pages(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<IndexedPage>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .get_pages(profile_id, limit, offset)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn index_page(
    state: State<'_, Mutex<AppState>>,
    page: IndexedPage,
    profile_id: i64,
) -> Result<IndexedPage, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .index_page(&page, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_memory(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    query: String,
) -> Result<Vec<IndexedPage>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .search_pages(profile_id, &query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_favorite_pages(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<IndexedPage>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .get_favorites(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_page_favorite(
    state: State<'_, Mutex<AppState>>,
    page_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .toggle_favorite(page_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_page_tags(
    state: State<'_, Mutex<AppState>>,
    page_id: i64,
    profile_id: i64,
    tags: String,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .update_tags(page_id, profile_id, &tags)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_indexed_page(
    state: State<'_, Mutex<AppState>>,
    page_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .delete_page(page_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_page_note(
    state: State<'_, Mutex<AppState>>,
    page_id: i64,
    content: String,
    profile_id: i64,
) -> Result<PageNote, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .add_note(page_id, &content, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_page_notes(
    state: State<'_, Mutex<AppState>>,
    page_id: i64,
) -> Result<Vec<PageNote>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .get_page_notes(page_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_page_note(
    state: State<'_, Mutex<AppState>>,
    note_id: i64,
    content: String,
    profile_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .update_note(note_id, &content, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_page_note(
    state: State<'_, Mutex<AppState>>,
    note_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .delete_note(note_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_memory_stats(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<MemoryStats, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .get_stats(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_memory_tags(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<String>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .get_all_tags(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_memory(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .export_memory(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_memory(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    json_data: String,
) -> Result<i64, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.memory_manager
        .import_memory(profile_id, &json_data)
        .map_err(|e| e.to_string())
}

// ==================== Domain Seeding Command ====================

#[tauri::command]
async fn seed_default_domains(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    resource_path: String,
) -> Result<i64, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.search_manager
        .seed_default_domains(profile_id, std::path::Path::new(&resource_path))
        .map_err(|e| e.to_string())
}

// ==================== Rating Commands ====================

#[tauri::command]
async fn submit_rating(
    state: State<'_, Mutex<AppState>>,
    rating: DomainRating,
) -> Result<DomainRating, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .submit_rating(&rating)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_user_rating(
    state: State<'_, Mutex<AppState>>,
    domain_id: i64,
    user_id: String,
) -> Result<Option<DomainRating>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .get_user_rating(domain_id, &user_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_domain_ratings(
    state: State<'_, Mutex<AppState>>,
    domain_id: i64,
    limit: Option<i64>,
) -> Result<Vec<DomainRating>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .get_domain_ratings(domain_id, limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_rating(
    state: State<'_, Mutex<AppState>>,
    rating_id: i64,
    user_id: String,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .delete_rating(rating_id, &user_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_rating_aggregate(
    state: State<'_, Mutex<AppState>>,
    domain_id: i64,
) -> Result<Option<RatingAggregate>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .get_aggregate(domain_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_rating_summary(
    state: State<'_, Mutex<AppState>>,
    domain_id: i64,
    domain_url: String,
) -> Result<RatingSummary, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .get_rating_summary(domain_id, &domain_url)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn submit_subdomain_rating(
    state: State<'_, Mutex<AppState>>,
    parent_domain_id: i64,
    subdomain: String,
    trust: f64,
    bias: f64,
) -> Result<SubdomainRating, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .submit_subdomain_rating(parent_domain_id, &subdomain, trust, bias)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_subdomain_ratings(
    state: State<'_, Mutex<AppState>>,
    parent_domain_id: i64,
) -> Result<Vec<SubdomainRating>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .get_subdomain_ratings(parent_domain_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn mark_rating_helpful(
    state: State<'_, Mutex<AppState>>,
    rating_id: i64,
) -> Result<i32, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .mark_helpful(rating_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn report_rating(
    state: State<'_, Mutex<AppState>>,
    rating_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .report_rating(rating_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_user_rating_history(
    state: State<'_, Mutex<AppState>>,
    user_id: String,
) -> Result<UserRatingHistory, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .get_user_history(&user_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_rating_category_scores(
    state: State<'_, Mutex<AppState>>,
    rating_id: i64,
    categories: Vec<(String, i32)>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.rating_manager
        .add_category_scores(rating_id, categories)
        .map_err(|e| e.to_string())
}

// ==================== Theme Commands ====================

#[tauri::command]
async fn get_themes(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<Theme>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .get_themes(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_active_theme(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Option<Theme>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .get_active_theme(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_theme(
    state: State<'_, Mutex<AppState>>,
    theme: Theme,
) -> Result<Theme, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .save_theme(&theme)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_active_theme(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    theme_id: i64,
) -> Result<Theme, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .set_active_theme(profile_id, theme_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_theme(
    state: State<'_, Mutex<AppState>>,
    theme_id: i64,
    profile_id: i64,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .delete_theme(theme_id, profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn apply_preset_theme(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    preset_id: String,
) -> Result<Theme, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .apply_preset(profile_id, &preset_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_theme_presets() -> Vec<PresetTheme> {
    get_preset_themes()
}

#[tauri::command]
async fn export_theme(
    state: State<'_, Mutex<AppState>>,
    theme_id: i64,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.theme_manager
        .export_theme(theme_id)
        .map_err(|e| e.to_string())
}

// ==================== Tab Commands ====================

#[tauri::command]
async fn create_tab(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    url: String,
    title: Option<String>,
) -> Result<Tab, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .create_tab(profile_id, &url, title.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_tab(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .close_tab(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_tabs(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<Tab>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .get_all_tabs(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_tab(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
    title: Option<String>,
    url: Option<String>,
    favicon: Option<String>,
) -> Result<Tab, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .update_tab(tab_id, title.as_deref(), url.as_deref(), favicon.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn reorder_tabs(
    state: State<'_, Mutex<AppState>>,
    tab_ids: Vec<i64>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .reorder_tabs(tab_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn pin_tab(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
    pinned: bool,
) -> Result<Tab, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .pin_tab(tab_id, pinned)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_active_tab(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<Tab, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .set_active_tab(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_tab_history(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<Vec<TabHistoryEntry>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .get_tab_history(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn navigate_tab_back(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<Option<String>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .navigate_back(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn navigate_tab_forward(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<Option<String>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .navigate_forward(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn duplicate_tab(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<Tab, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .duplicate_tab(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_tabs_to_right(
    state: State<'_, Mutex<AppState>>,
    tab_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .close_tabs_to_right(tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_unpinned_tabs(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.tab_manager
        .close_unpinned_tabs(profile_id)
        .map_err(|e| e.to_string())
}

// ==================== Bookmark Commands ====================

#[tauri::command]
async fn add_bookmark(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    title: String,
    url: String,
    folder_id: Option<i64>,
    tags: Vec<String>,
    notes: Option<String>,
) -> Result<Bookmark, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .add_bookmark(profile_id, &title, &url, folder_id, tags, notes.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_bookmark(
    state: State<'_, Mutex<AppState>>,
    bookmark_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .delete_bookmark(bookmark_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_bookmarks(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<Bookmark>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .get_all_bookmarks(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_bookmarks_by_folder(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    folder_id: Option<i64>,
) -> Result<Vec<Bookmark>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .get_bookmarks_by_folder(profile_id, folder_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_bookmarks(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    query: String,
) -> Result<Vec<Bookmark>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .search_bookmarks(profile_id, &query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_bookmark(
    state: State<'_, Mutex<AppState>>,
    bookmark_id: i64,
    title: Option<String>,
    url: Option<String>,
    folder_id: Option<Option<i64>>,
    tags: Option<Vec<String>>,
    notes: Option<Option<String>>,
    favicon: Option<String>,
) -> Result<Bookmark, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .update_bookmark(
            bookmark_id,
            title.as_deref(),
            url.as_deref(),
            folder_id,
            tags,
            notes.as_ref().map(|n| n.as_deref()),
            favicon.as_deref(),
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn is_url_bookmarked(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    url: String,
) -> Result<Option<i64>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .is_bookmarked(profile_id, &url)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_bookmark_folder(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    name: String,
    parent_id: Option<i64>,
) -> Result<BookmarkFolder, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .create_folder(profile_id, &name, parent_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_bookmark_folders(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<BookmarkFolder>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .get_all_folders(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_bookmark_folder(
    state: State<'_, Mutex<AppState>>,
    folder_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .delete_folder(folder_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_bookmark_folder(
    state: State<'_, Mutex<AppState>>,
    folder_id: i64,
    name: String,
) -> Result<BookmarkFolder, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.bookmark_manager
        .rename_folder(folder_id, &name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_bookmarks(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    format: String,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    match format.as_str() {
        "html" => state.bookmark_manager
            .export_bookmarks_html(profile_id)
            .map_err(|e| e.to_string()),
        _ => state.bookmark_manager
            .export_bookmarks_json(profile_id)
            .map_err(|e| e.to_string()),
    }
}

#[tauri::command]
async fn import_bookmarks(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    data: String,
    format: String,
) -> Result<i32, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    match format.as_str() {
        "html" => state.bookmark_manager
            .import_bookmarks_html(profile_id, &data)
            .map_err(|e| e.to_string()),
        _ => state.bookmark_manager
            .import_bookmarks_json(profile_id, &data)
            .map_err(|e| e.to_string()),
    }
}

// ==================== Split View Commands ====================

#[tauri::command]
async fn get_split_config(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .get_config(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_split_layout(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    layout: String,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .set_layout(profile_id, &layout)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_pane_tab(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    pane_number: i32,
    tab_id: Option<i64>,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .set_pane_tab(profile_id, pane_number, tab_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_active_pane(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    pane_number: i32,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .set_active_pane(profile_id, pane_number)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn cycle_pane(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    direction: i32,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .cycle_pane(profile_id, direction)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_pane_sizes(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    sizes: PaneSizes,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .update_pane_sizes(profile_id, sizes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn swap_panes(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    pane_a: i32,
    pane_b: i32,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .swap_panes(profile_id, pane_a, pane_b)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn reset_split_view(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<SplitViewConfig, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.split_view_manager
        .reset_to_single(profile_id)
        .map_err(|e| e.to_string())
}

// ==================== EarthMultiMedia Commands ====================

#[tauri::command]
async fn get_media_privacy_settings(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<MediaPrivacySettings, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .get_privacy_settings(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_media_privacy_settings(
    state: State<'_, Mutex<AppState>>,
    settings: MediaPrivacySettings,
) -> Result<MediaPrivacySettings, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .update_privacy_settings(&settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_media_password(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    password: String,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .set_password(profile_id, &password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn verify_media_password(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    password: String,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .verify_password(profile_id, &password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_media_otp_secret(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<String, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .generate_otp_secret(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn verify_media_otp(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    code: String,
) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .verify_otp(profile_id, &code)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_media_history_entry(
    state: State<'_, Mutex<AppState>>,
    entry: MediaHistoryEntry,
    password: Option<String>,
) -> Result<Option<MediaHistoryEntry>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .add_history_entry(&entry, password.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_history(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    limit: i32,
    password: Option<String>,
) -> Result<Vec<MediaHistoryEntry>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .get_history(profile_id, limit, password.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_media_history(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<i32, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .clear_history(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_media_history_entry(
    state: State<'_, Mutex<AppState>>,
    entry_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .delete_history_entry(entry_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_media_playlist(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    name: String,
    description: Option<String>,
    encrypted: bool,
) -> Result<Playlist, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .create_playlist(profile_id, &name, description.as_deref(), encrypted)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_playlists(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<Playlist>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .get_playlists(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_media_playlist(
    state: State<'_, Mutex<AppState>>,
    playlist_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .delete_playlist(playlist_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_to_media_playlist(
    state: State<'_, Mutex<AppState>>,
    playlist_id: i64,
    source: String,
    media_type: String,
    title: Option<String>,
    thumbnail: Option<String>,
) -> Result<PlaylistItem, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .add_to_playlist(playlist_id, &source, &media_type, title.as_deref(), thumbnail.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_playlist_items(
    state: State<'_, Mutex<AppState>>,
    playlist_id: i64,
) -> Result<Vec<PlaylistItem>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .get_playlist_items(playlist_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_from_media_playlist(
    state: State<'_, Mutex<AppState>>,
    item_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .remove_from_playlist(item_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn reorder_media_playlist_items(
    state: State<'_, Mutex<AppState>>,
    playlist_id: i64,
    item_ids: Vec<i64>,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .reorder_playlist_items(playlist_id, item_ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_stats(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<MediaStats, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.multimedia_manager
        .get_stats(profile_id)
        .map_err(|e| e.to_string())
}

// ==================== Web Scraper Commands ====================

#[tauri::command]
async fn create_scraping_job(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    name: String,
    base_url: String,
    url_pattern: Option<String>,
    max_depth: i32,
    max_pages: i32,
    content_selectors: Vec<ContentSelector>,
) -> Result<i64, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.scraper_manager
        .create_job(
            profile_id,
            &name,
            &base_url,
            url_pattern.as_deref(),
            max_depth,
            max_pages,
            content_selectors,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_scraping_jobs(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
) -> Result<Vec<ScrapingJob>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.scraper_manager
        .get_jobs(profile_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_scraping_job(
    state: State<'_, Mutex<AppState>>,
    job_id: i64,
) -> Result<ScrapingJob, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.scraper_manager
        .get_job(job_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_scraping_job(
    state: State<'_, Mutex<AppState>>,
    job_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.scraper_manager
        .delete_job(job_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_scraped_pages(
    state: State<'_, Mutex<AppState>>,
    job_id: i64,
    limit: i32,
) -> Result<Vec<ScrapedPage>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.scraper_manager
        .get_pages(job_id, limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_scraped_content(
    state: State<'_, Mutex<AppState>>,
    profile_id: i64,
    query: String,
    limit: i32,
) -> Result<Vec<ScrapedPage>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    state.scraper_manager
        .search_content(profile_id, &query, limit)
        .map_err(|e| e.to_string())
}

// ==================== Legacy Commands (for compatibility) ====================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to EarthServers Local.", name)
}

#[tauri::command]
async fn search_domains(query: String) -> Result<String, String> {
    Ok(format!("Searching for: {}", query))
}

#[tauri::command]
async fn add_domain(domain: String) -> Result<String, String> {
    Ok(format!("Added domain: {}", domain))
}

#[tauri::command]
async fn query_knowledge_graph(query: String) -> Result<String, String> {
    Ok(format!("Knowledge graph query: {}", query))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database directory
            let app_dir = app.path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");

            println!("App data directory: {:?}", app_dir);

            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");

            // Set up database path
            let db_path = app_dir.join("earthservers.db");
            let db_path_str = db_path.to_string_lossy().to_string();

            // Initialize managers
            let profile_manager = ProfileManager::new(db_path_str.clone());
            let privacy_manager = PrivacyManager::new(db_path_str.clone());
            let knowledge_graph = KnowledgeGraph::new(db_path_str.clone());
            let theme_manager = ThemeManager::new(db_path_str.clone());
            let search_manager = SearchManager::new(db_path_str.clone());
            let memory_manager = MemoryManager::new(db_path_str.clone());
            let rating_manager = RatingManager::new(db_path_str.clone());
            let tab_manager = TabManager::new(db_path_str.clone());
            let bookmark_manager = BookmarkManager::new(db_path_str.clone());
            let split_view_manager = SplitViewManager::new(db_path_str.clone());
            let multimedia_manager = MultimediaManager::new(db_path_str.clone());
            let scraper_manager = ScraperManager::new(db_path_str.clone());

            // Initialize database tables
            profile_manager.init().expect("Failed to initialize profile tables");
            knowledge_graph.init().expect("Failed to initialize knowledge graph");
            theme_manager.init().expect("Failed to initialize theme tables");
            search_manager.init().expect("Failed to initialize search tables");
            memory_manager.init().expect("Failed to initialize memory tables");

            // Seed default domains for the active profile
            if let Ok(Some(active_profile)) = profile_manager.get_active_profile() {
                // Get resource directory
                if let Some(resource_dir) = app.path_resolver().resource_dir() {
                    if let Ok(imported) = search_manager.seed_default_domains(active_profile.id.unwrap_or(1), &resource_dir) {
                        if imported > 0 {
                            println!("Seeded {} default domains", imported);
                        }
                    }
                }
            }

            // Store state
            let state = AppState {
                db_path: db_path_str,
                profile_manager,
                privacy_manager,
                knowledge_graph,
                theme_manager,
                search_manager,
                memory_manager,
                rating_manager,
                tab_manager,
                bookmark_manager,
                split_view_manager,
                multimedia_manager,
                scraper_manager,
            };

            app.manage(Mutex::new(state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Profile commands
            get_profiles,
            get_active_profile,
            create_profile,
            switch_profile,
            update_profile,
            delete_profile,
            get_privacy_settings,
            update_privacy_settings,
            export_profile,
            // Incognito commands
            get_incognito_status,
            toggle_incognito,
            set_incognito,
            // History commands
            get_history,
            delete_history_entry,
            delete_history_by_date_range,
            clear_all_history,
            get_history_stats,
            export_history,
            // Knowledge graph commands
            add_page,
            search_knowledge_graph,
            // Theme commands
            get_themes,
            get_active_theme,
            save_theme,
            set_active_theme,
            delete_theme,
            apply_preset_theme,
            get_theme_presets,
            export_theme,
            // Domain commands (EarthSearch)
            get_domains,
            add_domain_entry,
            update_domain,
            delete_domain_entry,
            search_domain_list,
            get_domain_lists,
            create_domain_list,
            delete_domain_list,
            get_domain_stats,
            get_domain_categories,
            export_domains,
            import_domains,
            // Memory commands (EarthMemory)
            get_indexed_pages,
            index_page,
            search_memory,
            get_favorite_pages,
            toggle_page_favorite,
            update_page_tags,
            delete_indexed_page,
            add_page_note,
            get_page_notes,
            update_page_note,
            delete_page_note,
            get_memory_stats,
            get_memory_tags,
            export_memory,
            import_memory,
            // Rating commands
            submit_rating,
            get_user_rating,
            get_domain_ratings,
            delete_rating,
            get_rating_aggregate,
            get_rating_summary,
            submit_subdomain_rating,
            get_subdomain_ratings,
            mark_rating_helpful,
            report_rating,
            get_user_rating_history,
            add_rating_category_scores,
            // Domain seeding
            seed_default_domains,
            // Tab commands
            create_tab,
            close_tab,
            get_all_tabs,
            update_tab,
            reorder_tabs,
            pin_tab,
            set_active_tab,
            get_tab_history,
            navigate_tab_back,
            navigate_tab_forward,
            duplicate_tab,
            close_tabs_to_right,
            close_unpinned_tabs,
            // Bookmark commands
            add_bookmark,
            delete_bookmark,
            get_all_bookmarks,
            get_bookmarks_by_folder,
            search_bookmarks,
            update_bookmark,
            is_url_bookmarked,
            create_bookmark_folder,
            get_bookmark_folders,
            delete_bookmark_folder,
            rename_bookmark_folder,
            export_bookmarks,
            import_bookmarks,
            // Split view commands
            get_split_config,
            set_split_layout,
            set_pane_tab,
            set_active_pane,
            cycle_pane,
            update_pane_sizes,
            swap_panes,
            reset_split_view,
            // EarthMultiMedia commands
            get_media_privacy_settings,
            update_media_privacy_settings,
            set_media_password,
            verify_media_password,
            generate_media_otp_secret,
            verify_media_otp,
            add_media_history_entry,
            get_media_history,
            clear_media_history,
            delete_media_history_entry,
            create_media_playlist,
            get_media_playlists,
            delete_media_playlist,
            add_to_media_playlist,
            get_media_playlist_items,
            remove_from_media_playlist,
            reorder_media_playlist_items,
            get_media_stats,
            // Web Scraper commands
            create_scraping_job,
            get_scraping_jobs,
            get_scraping_job,
            delete_scraping_job,
            get_scraped_pages,
            search_scraped_content,
            // Legacy commands
            greet,
            search_domains,
            add_domain,
            query_knowledge_graph
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
