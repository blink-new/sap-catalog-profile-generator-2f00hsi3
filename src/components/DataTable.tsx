import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  title: string;
  description?: string;
  onExport?: (format: 'csv' | 'xlsx') => void;
  maxHeight?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  title,
  description,
  onExport,
  maxHeight = '600px'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map(col => col.key));

  // Get unique values for filterable columns
  const getUniqueValues = (columnKey: string): string[] => {
    const values = data.map(row => row[columnKey]).filter(Boolean);
    return [...new Set(values)].sort();
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues.length > 0) {
        filtered = filtered.filter(row =>
          selectedValues.includes(String(row[columnKey]))
        );
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig, columnFilters]);

  const handleSort = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    setSortConfig(current => {
      if (current?.key === columnKey) {
        return current.direction === 'asc' 
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  const handleColumnFilterChange = (columnKey: string, value: string, checked: boolean) => {
    setColumnFilters(prev => {
      const currentFilters = prev[columnKey] || [];
      if (checked) {
        return { ...prev, [columnKey]: [...currentFilters, value] };
      } else {
        return { ...prev, [columnKey]: currentFilters.filter(v => v !== value) };
      }
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
    setSortConfig(null);
  };

  const exportData = (format: 'csv' | 'xlsx') => {
    if (onExport) {
      onExport(format);
      return;
    }

    // Default CSV export
    if (format === 'csv') {
      const visibleCols = columns.filter(col => visibleColumns.includes(col.key));
      const headers = visibleCols.map(col => col.label).join(',');
      const rows = processedData.map(row => 
        visibleCols.map(col => `"${String(row[col.key] || '')}"`).join(',')
      ).join('\n');
      
      const csvContent = headers + '\n' + rows;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig?.key === columnKey) {
      return sortConfig.direction === 'asc' ? 
        <ChevronUp className="h-4 w-4" /> : 
        <ChevronDown className="h-4 w-4" />;
    }
    return null;
  };

  const getActiveFiltersCount = () => {
    return Object.values(columnFilters).reduce((count, filters) => count + filters.length, 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {processedData.length} of {data.length} rows
            </Badge>
            {onExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportData('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportData('xlsx')}>
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {getActiveFiltersCount() > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {getActiveFiltersCount()}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Column Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.filter(col => col.filterable).map(column => {
                const uniqueValues = getUniqueValues(column.key);
                const selectedValues = columnFilters[column.key] || [];
                
                return (
                  <DropdownMenu key={column.key}>
                    <DropdownMenuTrigger asChild>
                      <DropdownMenuItem className="cursor-pointer">
                        {column.label}
                        {selectedValues.length > 0 && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {selectedValues.length}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 max-h-64 overflow-y-auto">
                      {uniqueValues.slice(0, 20).map(value => (
                        <DropdownMenuItem key={value} className="p-0">
                          <label className="flex items-center w-full p-2 cursor-pointer">
                            <Checkbox
                              checked={selectedValues.includes(value)}
                              onCheckedChange={(checked) => 
                                handleColumnFilterChange(column.key, value, checked as boolean)
                              }
                              className="mr-2"
                            />
                            <span className="text-sm truncate">{value}</span>
                          </label>
                        </DropdownMenuItem>
                      ))}
                      {uniqueValues.length > 20 && (
                        <DropdownMenuItem disabled>
                          ... and {uniqueValues.length - 20} more
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearFilters}>
                Clear All Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map(column => (
                <DropdownMenuItem key={column.key} className="p-0">
                  <label className="flex items-center w-full p-2 cursor-pointer">
                    <Checkbox
                      checked={visibleColumns.includes(column.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setVisibleColumns(prev => [...prev, column.key]);
                        } else {
                          setVisibleColumns(prev => prev.filter(key => key !== column.key));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{column.label}</span>
                  </label>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {columns
                  .filter(col => visibleColumns.includes(col.key))
                  .map(column => (
                    <th
                      key={column.key}
                      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                      style={{ width: column.width }}
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="flex items-center gap-1">
                        {column.label}
                        {column.sortable && getSortIcon(column.key)}
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {columns
                    .filter(col => visibleColumns.includes(col.key))
                    .map(column => (
                      <td key={column.key} className="px-4 py-3 text-sm text-gray-900">
                        <div className="truncate" title={String(row[column.key] || '')}>
                          {String(row[column.key] || '')}
                        </div>
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {processedData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No data found matching your criteria
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};