export function HelpModal({onClose}){
  const sections=[
    {
      title:'Overview',
      icon:'📊',
      content:[
        {q:'What is CapacityIQ?',a:'CapacityIQ is a resource planning tool for tracking engineering staffing across projects. It shows how many engineers are assigned to each project (supply) versus how many are needed (demand), across a rolling 12-month view.'},
        {q:'Who can see my changes?',a:'All data is shared across everyone at BD who visits this page — changes you make are saved automatically and visible to everyone within a few seconds.'},
      ]
    },
    {
      title:'Supply vs Demand modes',
      icon:'🔀',
      content:[
        {q:'What is Supply mode?',a:'Supply mode (default) shows actual engineer assignments. Click any cell to open an assignment panel where you can add or remove engineers for that project × discipline × month. The colored bar in each cell shows how staffed the project is relative to its demand target.'},
        {q:'What is Demand mode?',a:'Demand mode shows FTE targets — how many engineers a project needs per discipline. Click a cell to increase the target by 1 FTE; Shift-click to decrease by 1. A red heatmap shows relative demand intensity across projects.'},
        {q:'How do I switch modes?',a:'Use the Supply / Demand toggle buttons in the top-right of the header.'},
      ]
    },
    {
      title:'Timeline grid',
      icon:'📅',
      content:[
        {q:'Navigating months',a:'Click the ‹ and › arrows in the header to shift the 12-month window one month at a time. Click the date range label to snap back to today. A "click above to snap to today" hint appears when you\'ve scrolled away.'},
        {q:'Expanding a project',a:'Click the ▶ chevron on any project row to expand it and see per-discipline swimlanes. Click again to collapse. Use "expand all" / "collapse all" in the column header.'},
        {q:'Past months',a:'Months before the current month are desaturated so you can focus on what\'s ahead.'},
        {q:'Current month',a:'The current month column is highlighted in blue.'},
        {q:'Discipline filter',a:'Use the discipline chips in the column header to show/hide specific disciplines across the whole grid.'},
      ]
    },
    {
      title:'Reading supply cells',
      icon:'🔵',
      content:[
        {q:'What does the number mean?',a:'In supply mode, expanded rows show a gap number: −2.5 means 2.5 FTE short of demand; +1.0 means 1 FTE over; ✓ means fully staffed.'},
        {q:'Bar colors',a:'Red = under 70% staffed · Amber = 70–99% · Blue = 100–105% · Green = over 105% (overstaffed).'},
        {q:'Collapsed project row',a:'Shows the overall supply/demand gap across all disciplines for that month.'},
        {q:'TOTAL row',a:'The sticky row at the top of the grid shows org-wide demand vs supply totals for each month.'},
      ]
    },
    {
      title:'Demand heatmap',
      icon:'🌡️',
      content:[
        {q:'Project-level heatmap',a:'When all projects are collapsed in Demand mode, each project row is shaded red based on its total FTE demand for that month. White = lowest demand, deep red = highest. Scale is relative to the highest-demand project.'},
        {q:'Discipline-level heatmap',a:'When any project is expanded, the per-discipline swimlane cells are shaded by individual FTE demand on their own scale. The project row heatmaps hide while discipline heatmaps are visible.'},
      ]
    },
    {
      title:'Assigning engineers',
      icon:'👤',
      content:[
        {q:'Adding an assignment',a:'In Supply mode, click any active cell to open the assignment panel. Engineers are grouped by discipline. Click an engineer\'s name to assign them; set their start/end months and allocation percentage.'},
        {q:'Removing an assignment',a:'Open the assignment panel and click the × next to an engineer\'s name to remove them from that project.'},
        {q:'Extending an assignment',a:'Drag the end-month handle on an existing assignment to extend or shorten it.'},
      ]
    },
    {
      title:'Projects',
      icon:'📁',
      content:[
        {q:'Adding a project',a:'Click the ⊕ Add Project button in the action menu (top-right ··· button). Fill in the project name, color, date range, and per-discipline FTE targets.'},
        {q:'Editing a project',a:'Click the project name in the left column to open its edit panel.'},
        {q:'Deleting a project',a:'Open the project edit panel and click Delete. All assignments for that project are also removed.'},
        {q:'Reordering projects',a:'Drag a project row by its handle to reorder it in the list.'},
      ]
    },
    {
      title:'People & Org Chart',
      icon:'🏢',
      content:[
        {q:'What is the People tab?',a:'The People tab shows your entire org in two sub-views: Org Chart (visual hierarchy) and List (searchable roster). Switch between them using the tabs at the top of the page.'},
        {q:'Navigating the org chart',a:'Click any node to open a side panel showing its sub-teams and headcount. Click a sub-team name to drill into it. Use the ← back button to go up a level.'},
        {q:'Tier colors',a:'Each department uses a distinct color. Nodes get progressively lighter as you go deeper in the hierarchy — top nodes are the most saturated, leaf nodes are the lightest tint.'},
        {q:'Tier labels',a:'The five hierarchy levels are: Business Unit → Department → Discipline → Subdiscipline → Team.'},
        {q:'Role badges',a:'D (red) = Director or VP · M (purple) = Manager · C (amber) = Contractor. Badges appear on engineer rows in the side panel and in the List view.'},
        {q:'Sort order',a:'Within any team, Directors appear first, then Managers, then individual contributors, then Contractors — each group sorted alphabetically.'},
        {q:'List view',a:'The List view shows all engineers as a flat table. Row background colors match each person\'s department from the org chart. Use the search box to filter by name, title, or discipline.'},
      ]
    },
    {
      title:'Org Staffing Analytics',
      icon:'📈',
      content:[
        {q:'What does it show?',a:'The analytics section (below the grid) gives a snapshot of org-wide staffing health as of today. The Overall card shows total supply vs demand; discipline cards break it down per team.'},
        {q:'Card metrics',a:'Each card shows: current FTE supply, FTE demand target, a GAP (difference), a staffing ratio bar, and a sparkline of how supply has trended across the visible months.'},
      ]
    },
    {
      title:'Change Log',
      icon:'📝',
      content:[
        {q:'What is the Change Log?',a:'Every assignment add/remove, demand edit, and project change is recorded in the Change Log. It\'s shared across all users — you can see what your teammates changed.'},
        {q:'Grouped entries',a:'Rapid edits to the same cell are grouped into one collapsible entry. Click the ▶ on a row to expand its history.'},
        {q:'Full view',a:'Click "Full view" to open a searchable, filterable modal showing up to 50 entries with filters for project, discipline, resource, and date.'},
      ]
    },
    {
      title:'Undo / Redo',
      icon:'↩',
      content:[
        {q:'Keyboard shortcuts',a:'Ctrl+Z (or ⌘Z on Mac) to undo · Ctrl+Shift+Z (or ⌘⇧Z) to redo. The ↩ ↪ buttons in the header do the same.'},
        {q:'What can be undone?',a:'All data changes: assignments, demand edits, project adds/edits/deletes, and imports. View changes (scrolling, expanding rows, dark mode) are not tracked in the undo history.'},
        {q:'History depth',a:'Up to 50 undo steps are kept in the rolling buffer.'},
      ]
    },
    {
      title:'Export & Import',
      icon:'💾',
      content:[
        {q:'Exporting data',a:'Open the ··· action menu and click Export CSV. Downloads a CSV with all projects, engineers, and assignments in three clearly labelled sections — use this to back up or share your data.'},
        {q:'Restoring a backup',a:'Open the ··· action menu and click Import CSV. Select a previously exported CapacityIQ file. This replaces all current data — use it to restore a snapshot or load a different team\'s data.'},
        {q:'Importing an org chart',a:'To load a new team structure, use Import Org Chart (admin only) in the ··· menu. This reads a Workday org chart CSV export and replaces the current engineer roster. Project demand settings are preserved.'},
        {q:'Getting a Workday export',a:'In Workday, navigate to your org → Actions → Export to Spreadsheet → Org Chart. Choose CSV format and include all subordinate levels. Required columns: Name, Unique Identifier, Reports To, Line Detail 1, Organization Name.'},
      ]
    },
  ];

  React.useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[onClose]);

  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="settings-modal" style={{maxWidth:'680px',width:'100%',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
        <div className="modal-hdr">
          <span className="modal-title">CapacityIQ — How to use</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'20px 24px',display:'flex',flexDirection:'column',gap:'28px'}}>
          {sections.map(sec=>(
            <div key={sec.title}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',paddingBottom:'8px',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:'1.1rem'}}>{sec.icon}</span>
                <span style={{fontWeight:700,fontSize:'.95rem',color:'var(--text-1)'}}>{sec.title}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {sec.content.map(({q,a})=>(
                  <div key={q} style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'8px 16px',alignItems:'baseline'}}>
                    <div style={{fontSize:'.8rem',fontWeight:600,color:'var(--text-2)'}}>{q}</div>
                    <div style={{fontSize:'.82rem',color:'var(--text-2)',lineHeight:1.55}}>{a}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
