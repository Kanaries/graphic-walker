import re
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from logging_config import get_logger

logger = get_logger("sql_processor")

@dataclass
class ProcessingResult:
    """Result of SQL processing operation."""
    original: str
    cleaned: str
    processing_steps: List[str]
    warnings: List[str]
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "original": self.original,
            "cleaned": self.cleaned,
            "processing_steps": self.processing_steps,
            "warnings": self.warnings,
            "metadata": self.metadata
        }

class SQLProcessor:
    """
    Advanced SQL response processor for cleaning and validating Ollama model outputs.
    Handles various markdown formats, code blocks, and common model response patterns.
    """
    
    def __init__(self):
        """Initialize SQL processor with cleaning patterns."""
        self.markdown_patterns = [
            # Code blocks with language specification
            (r'```sql\s*\n(.*?)\n```', r'\1', 'Removed SQL code block markers'),
            (r'```SQL\s*\n(.*?)\n```', r'\1', 'Removed SQL code block markers (uppercase)'),
            (r'```\s*\n(.*?)\n```', r'\1', 'Removed generic code block markers'),
            
            # Inline code markers
            (r'`([^`]+)`', r'\1', 'Removed inline code markers'),
            
            # Language tags at the beginning
            (r'^sql\s*\n?', '', 'Removed SQL language tag'),
            (r'^SQL\s*\n?', '', 'Removed SQL language tag (uppercase)'),
            
            # Common prefixes from model responses
            (r'^(Here\'s the SQL|Here is the SQL|The SQL query is|SQL:)\s*:?\s*\n?', '', 'Removed response prefix'),
            (r'^(Query|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s*:', r'\1', 'Cleaned query prefix'),
        ]
        
        # Enhanced patterns for Ollama-specific response cleaning
        self.ollama_patterns = [
            # Remove explanatory text before SQL
            (r'^.*?(?=SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|CASE)', '', 'Removed explanatory text before SQL'),
            
            # Remove explanatory text after SQL (common patterns)
            (r'(;|\n)\s*(This query|This SQL|The above|Note:|Explanation:|Here\'s what|This will|This gives).*$', r'\1', 'Removed explanatory text after SQL'),
            (r'\.\s*(This query|This SQL|The above|Note:|Explanation:|Here\'s what|This will|This gives).*$', '', 'Removed explanatory text after SQL'),
            
            # Remove common Ollama response patterns
            (r'^(Based on your request|To create|For this|You can use|Try this|To calculate).*?[:]\s*', '', 'Removed Ollama response prefix'),
            
            # Remove markdown-style explanations
            (r'\*\*.*?\*\*', '', 'Removed markdown bold text'),
            (r'\n\s*\*.*$', '', 'Removed bullet point explanations'),
            
            # Remove "CREATE COMPUTED FIELD" wrapper if present
            (r'^CREATE\s+COMPUTED\s+FIELD\s+\w+\s+AS\s*\(\s*(.*?)\s*\)\s*$', r'\1', 'Extracted expression from computed field wrapper'),
            
            # Clean up common expression patterns
            (r'^CASE\s+WHEN\s+(.*?)\s+END\s*$', r'CASE WHEN \1 END', 'Cleaned CASE expression'),
            
            # Remove trailing explanatory sentences
            (r'\s+(This\s+\w+|It\s+\w+|The\s+\w+).*$', '', 'Removed trailing explanation'),
        ]
        
        self.cleanup_patterns = [
            # Remove extra whitespace
            (r'\n\s*\n', '\n', 'Removed extra blank lines'),
            (r'^\s+', '', 'Removed leading whitespace'),
            (r'\s+$', '', 'Removed trailing whitespace'),
            
            # Fix common formatting issues
            (r'\s+', ' ', 'Normalized whitespace'),
            (r';\s*;+', ';', 'Removed duplicate semicolons'),
            
            # Fix unmatched parentheses at the end
            (r'\)\s*$', '', 'Removed trailing unmatched parenthesis'),
            (r'^\s*\(', '', 'Removed leading unmatched parenthesis'),
        ]
        
        # SQL keywords for validation
        self.sql_keywords = {
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
            'GROUP', 'BY', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT',
            'EXCEPT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE',
            'TABLE', 'INDEX', 'VIEW', 'ALTER', 'DROP', 'TRUNCATE', 'WITH', 'AS',
            'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
            'BETWEEN', 'LIKE', 'IS', 'NULL', 'DISTINCT', 'ALL', 'ANY', 'SOME'
        }
    
    def process_response(self, raw_response: str, context: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        """
        Process raw model response into clean SQL.
        
        Args:
            raw_response: Raw response from the model
            context: Optional context information for processing
            
        Returns:
            ProcessingResult with cleaned SQL and metadata
        """
        if not raw_response or not raw_response.strip():
            return ProcessingResult(
                original=raw_response or "",
                cleaned="",
                processing_steps=["Input was empty"],
                warnings=["Empty or null input provided"],
                metadata={"input_length": 0, "output_length": 0}
            )
        
        original = raw_response
        current = raw_response
        steps = []
        warnings = []
        
        logger.info(
            "Starting SQL response processing",
            extra={
                "input_length": len(raw_response),
                "input_preview": raw_response[:100] + "..." if len(raw_response) > 100 else raw_response
            }
        )
        
        # Step 1: Remove markdown formatting
        current, markdown_steps = self._remove_markdown_formatting(current)
        steps.extend(markdown_steps)
        
        # Step 2: Apply Ollama-specific cleaning
        current, ollama_steps = self._apply_ollama_cleaning(current)
        steps.extend(ollama_steps)
        
        # Step 3: Clean up whitespace and formatting
        current, cleanup_steps = self._cleanup_formatting(current)
        steps.extend(cleanup_steps)
        
        # Step 4: Validate and extract SQL
        current, validation_warnings = self._validate_and_extract_sql(current)
        warnings.extend(validation_warnings)
        
        # Step 5: Final cleanup
        current = current.strip()
        if current != current.strip():
            steps.append("Final whitespace cleanup")
        
        # Generate metadata
        metadata = self._generate_metadata(original, current, context)
        
        # Log processing results
        logger.info(
            "SQL response processing completed",
            extra={
                "original_length": len(original),
                "cleaned_length": len(current),
                "steps_count": len(steps),
                "warnings_count": len(warnings),
                "cleaned_preview": current[:100] + "..." if len(current) > 100 else current
            }
        )
        
        return ProcessingResult(
            original=original,
            cleaned=current,
            processing_steps=steps,
            warnings=warnings,
            metadata=metadata
        )
    
    def _remove_markdown_formatting(self, text: str) -> tuple[str, List[str]]:
        """Remove markdown formatting from text."""
        current = text
        steps = []
        
        for pattern, replacement, description in self.markdown_patterns:
            new_text = re.sub(pattern, replacement, current, flags=re.DOTALL | re.IGNORECASE)
            if new_text != current:
                steps.append(description)
                current = new_text
        
        return current, steps
    
    def _apply_ollama_cleaning(self, text: str) -> tuple[str, List[str]]:
        """Apply Ollama-specific cleaning patterns."""
        current = text
        steps = []
        
        # First, try to extract SQL from common Ollama response patterns
        for pattern, replacement, description in self.ollama_patterns:
            new_text = re.sub(pattern, replacement, current, flags=re.DOTALL | re.IGNORECASE | re.MULTILINE)
            if new_text != current:
                steps.append(description)
                current = new_text
        
        # Special handling for computed field expressions
        current = self._extract_computed_field_expression(current, steps)
        
        # Remove any remaining non-SQL text at the beginning or end
        current = self._extract_core_sql(current, steps)
        
        return current, steps
    
    def _extract_computed_field_expression(self, text: str, steps: List[str]) -> str:
        """Extract the core expression from computed field responses."""
        # Look for patterns like "CREATE COMPUTED FIELD ... AS (expression)"
        computed_field_pattern = r'CREATE\s+COMPUTED\s+FIELD\s+\w+\s+AS\s*\(\s*(.*?)\s*\)'
        match = re.search(computed_field_pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            steps.append("Extracted expression from CREATE COMPUTED FIELD wrapper")
            return match.group(1).strip()
        
        # Look for AS (expression) patterns
        as_pattern = r'AS\s*\(\s*(.*?)\s*\)(?:\s*$|\s*;|\s*\n|$)'
        match = re.search(as_pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            steps.append("Extracted expression from AS clause")
            return match.group(1).strip()
        
        return text
    
    def _extract_core_sql(self, text: str, steps: List[str]) -> str:
        """Extract the core SQL/expression from mixed content."""
        if not text.strip():
            return text
        
        # First try to find SQL in code blocks or after common patterns
        sql_patterns = [
            r'```sql\s*\n(.*?)\n```',
            r'```\s*\n(.*?)\n```',
            r'AS\s*\(\s*(.*?)\s*\)',
            r'(\bCASE\b.*?(?:\bEND\b|$))',
            r'(\bSELECT\b.*)',
        ]
        
        for pattern in sql_patterns:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match:
                extracted = match.group(1).strip()
                if extracted and len(extracted) > 5:  # Reasonable SQL length
                    steps.append("Extracted SQL from pattern match")
                    return extracted
        
        # If no pattern match, filter line by line
        lines = text.split('\n')
        sql_lines = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Skip obvious explanation lines
            if any(line.lower().startswith(prefix) for prefix in [
                'this query', 'this sql', 'the above', 'note:', 'explanation:',
                'here\'s what', 'this will', 'to create', 'for this', 'you can use',
                'based on', 'try this', '*', '-', '#', 'this gives', 'this creates'
            ]):
                continue
            
            # Skip lines that are clearly explanatory
            if any(phrase in line.lower() for phrase in [
                'will create', 'categorizes', 'gives different', 'based on',
                'this field', 'the field', 'customers', 'revenue'
            ]) and not any(keyword in line.upper() for keyword in ['CASE', 'WHEN', 'THEN', 'ELSE']):
                continue
            
            # Keep lines that look like SQL
            if any(keyword in line.upper() for keyword in [
                'SELECT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR',
                'SUM', 'COUNT', 'AVG', 'MAX', 'MIN', 'COALESCE', 'NULLIF',
                'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'CAST',
                'EXTRACT', 'DATE', 'YEAR', 'MONTH', 'DAY'
            ]):
                sql_lines.append(line)
            elif re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*\s*[=<>!]+', line):
                # Looks like a condition
                sql_lines.append(line)
            elif re.match(r'^[\(\)\s\w\d\+\-\*\/\.,\'\"=<>!]+$', line) and len(line) > 3:
                # Looks like an expression
                sql_lines.append(line)
        
        if sql_lines and len(sql_lines) < len(lines):
            steps.append("Filtered out non-SQL explanation lines")
            return ' '.join(sql_lines)
        
        return text
    
    def _cleanup_formatting(self, text: str) -> tuple[str, List[str]]:
        """Clean up whitespace and formatting issues."""
        current = text
        steps = []
        
        for pattern, replacement, description in self.cleanup_patterns:
            new_text = re.sub(pattern, replacement, current, flags=re.MULTILINE)
            if new_text != current:
                steps.append(description)
                current = new_text
        
        return current, steps
    
    def _validate_and_extract_sql(self, text: str) -> tuple[str, List[str]]:
        """Validate and extract SQL from processed text."""
        warnings = []
        
        if not text.strip():
            warnings.append("Processed text is empty")
            return text, warnings
        
        # Check if it looks like SQL
        text_upper = text.upper()
        has_sql_keywords = any(keyword in text_upper for keyword in self.sql_keywords)
        
        if not has_sql_keywords:
            warnings.append("Text does not appear to contain SQL keywords")
        
        # Check for common issues
        if text.count('(') != text.count(')'):
            warnings.append("Unmatched parentheses detected")
        
        if text.count("'") % 2 != 0:
            warnings.append("Unmatched single quotes detected")
        
        if text.count('"') % 2 != 0:
            warnings.append("Unmatched double quotes detected")
        
        # Check for multiple statements
        statements = [stmt.strip() for stmt in text.split(';') if stmt.strip()]
        if len(statements) > 1:
            warnings.append(f"Multiple SQL statements detected ({len(statements)} statements)")
            # Return only the first statement for safety
            text = statements[0]
            if not text.endswith(';'):
                text += ';'
        
        # Check for dangerous keywords (basic safety)
        dangerous_keywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE']
        found_dangerous = [kw for kw in dangerous_keywords if kw in text_upper]
        if found_dangerous:
            warnings.append(f"Potentially dangerous SQL keywords detected: {', '.join(found_dangerous)}")
        
        return text, warnings
    
    def _generate_metadata(self, original: str, cleaned: str, context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate metadata about the processing operation."""
        metadata = {
            "original_length": len(original),
            "cleaned_length": len(cleaned),
            "reduction_ratio": 1 - (len(cleaned) / len(original)) if original else 0,
            "has_sql_keywords": self._has_sql_keywords(cleaned),
            "estimated_complexity": self._estimate_sql_complexity(cleaned),
            "processing_timestamp": __import__('time').time()
        }
        
        if context:
            metadata["context"] = context
        
        return metadata
    
    def _has_sql_keywords(self, text: str) -> bool:
        """Check if text contains SQL keywords."""
        text_upper = text.upper()
        return any(keyword in text_upper for keyword in self.sql_keywords)
    
    def _estimate_sql_complexity(self, sql: str) -> str:
        """Estimate SQL complexity based on keywords and structure."""
        if not sql:
            return "empty"
        
        sql_upper = sql.upper()
        
        # Count complexity indicators
        complexity_score = 0
        
        # Basic keywords
        if 'SELECT' in sql_upper:
            complexity_score += 1
        if 'FROM' in sql_upper:
            complexity_score += 1
        
        # Joins
        join_keywords = ['JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN']
        complexity_score += sum(1 for kw in join_keywords if kw in sql_upper)
        
        # Subqueries
        complexity_score += sql.count('(') * 0.5
        
        # Aggregations
        agg_keywords = ['GROUP BY', 'HAVING', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN']
        complexity_score += sum(1 for kw in agg_keywords if kw in sql_upper)
        
        # Window functions
        if 'OVER' in sql_upper:
            complexity_score += 2
        
        # CTEs
        if 'WITH' in sql_upper:
            complexity_score += 2
        
        # Classify complexity
        if complexity_score <= 2:
            return "simple"
        elif complexity_score <= 5:
            return "moderate"
        elif complexity_score <= 10:
            return "complex"
        else:
            return "very_complex"
    
    def clean_sql_simple(self, raw_response: str) -> str:
        """
        Simple SQL cleaning method for backward compatibility.
        
        Args:
            raw_response: Raw response from model
            
        Returns:
            Cleaned SQL string
        """
        result = self.process_response(raw_response)
        return result.cleaned
    
    def validate_sql_syntax(self, sql: str) -> Dict[str, Any]:
        """
        Basic SQL syntax validation.
        
        Args:
            sql: SQL string to validate
            
        Returns:
            Dict with validation results
        """
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "suggestions": []
        }
        
        if not sql or not sql.strip():
            validation_result["is_valid"] = False
            validation_result["errors"].append("SQL is empty")
            return validation_result
        
        sql_upper = sql.upper().strip()
        
        # Check for basic SQL structure
        if not any(keyword in sql_upper for keyword in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP']):
            validation_result["warnings"].append("No recognized SQL statement type found")
        
        # Check for SELECT without FROM (unless it's a simple expression)
        if sql_upper.startswith('SELECT') and 'FROM' not in sql_upper and not re.match(r'SELECT\s+[\d\s\+\-\*\/\(\)]+$', sql_upper):
            validation_result["warnings"].append("SELECT statement without FROM clause")
        
        # Check for unmatched quotes and parentheses
        if sql.count("'") % 2 != 0:
            validation_result["errors"].append("Unmatched single quotes")
            validation_result["is_valid"] = False
        
        if sql.count('"') % 2 != 0:
            validation_result["errors"].append("Unmatched double quotes")
            validation_result["is_valid"] = False
        
        if sql.count('(') != sql.count(')'):
            validation_result["errors"].append("Unmatched parentheses")
            validation_result["is_valid"] = False
        
        # Check for SQL injection patterns (basic)
        injection_patterns = [
            r';\s*(DROP|DELETE|TRUNCATE|ALTER)',
            r'UNION\s+SELECT',
            r'--\s*\w+',
            r'/\*.*\*/'
        ]
        
        for pattern in injection_patterns:
            if re.search(pattern, sql_upper):
                validation_result["warnings"].append("Potentially dangerous SQL pattern detected")
        
        # Suggestions
        if not sql.rstrip().endswith(';'):
            validation_result["suggestions"].append("Consider adding semicolon at the end")
        
        return validation_result


# Global SQL processor instance
sql_processor = SQLProcessor()