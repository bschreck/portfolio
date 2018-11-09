function! ReplaceMustache()
    %s/{{{/ <%= /g
    %s/{{/ <%= /g
    %s/}}}/ %>/g
    %s/}}/ %>/g
endfunction
